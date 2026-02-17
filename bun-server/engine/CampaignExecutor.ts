import { PlaywrightManager } from './PlaywrightManager';
import { visitProfile } from './actions/visitProfile';
import { sendConnection } from './actions/sendConnection';
import { sendMessage } from './actions/sendMessage';
import { followProfile } from './actions/followProfile';
import { checkConnection } from './actions/checkConnection';
import { logger } from '../logger';
import { supabase } from '../lib/supabase';
import type { ActionResult, Campaign, CampaignStep, Lead } from '../../types';

interface CampaignLeadProgressRow {
  id: string;
  campaign_id: string;
  lead_id: string;
  profile_id: string;
  current_step: number;
  status: 'pending' | 'in_progress' | 'waiting' | 'completed' | 'failed' | 'skipped';
  next_action_at: string | null;
  last_action_at: string | null;
  step_results: Array<{ step: number; result: string; at: string }>;
}

interface StartOptions {
  campaignId?: string;
}

interface ExecutorStatus {
  running: boolean;
  ticking: boolean;
  activeCampaignId: string | null;
  lastTickAt: string | null;
}

const DEFAULT_TICK_MS = Number(process.env.CAMPAIGN_TICK_MS || 12000);
const DEFAULT_BATCH_SIZE = Number(process.env.CAMPAIGN_BATCH_SIZE || 10);

export class CampaignExecutor {
  private manager = new PlaywrightManager();
  private interval: NodeJS.Timeout | null = null;
  private running = false;
  private ticking = false;
  private activeCampaignId: string | null = null;
  private lastTickAt: string | null = null;

  async start(options: StartOptions = {}) {
    if (this.running) {
      return { started: false, reason: 'already_running', status: this.getStatus() };
    }

    this.activeCampaignId = options.campaignId ?? null;

    if (options.campaignId) {
      await this.initializeCampaignProgress(options.campaignId);
      await supabase
        .from('campaigns')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', options.campaignId);
    }

    this.running = true;
    this.interval = setInterval(() => {
      void this.tick();
    }, DEFAULT_TICK_MS);

    await this.tick();

    logger.info('CampaignExecutor started', {
      campaignId: this.activeCampaignId,
      tickMs: DEFAULT_TICK_MS,
      batchSize: DEFAULT_BATCH_SIZE,
    });

    return { started: true, status: this.getStatus() };
  }

  async stop(options: StartOptions = {}) {
    if (options.campaignId) {
      await supabase
        .from('campaigns')
        .update({ status: 'paused', updated_at: new Date().toISOString() })
        .eq('id', options.campaignId);
    }

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.running = false;
    this.activeCampaignId = options.campaignId ?? this.activeCampaignId;

    await this.manager.cleanup().catch(() => undefined);

    logger.info('CampaignExecutor stopped', {
      campaignId: options.campaignId ?? this.activeCampaignId,
    });

    return { stopped: true, status: this.getStatus() };
  }

  getStatus(): ExecutorStatus {
    return {
      running: this.running,
      ticking: this.ticking,
      activeCampaignId: this.activeCampaignId,
      lastTickAt: this.lastTickAt,
    };
  }

  async tick() {
    if (!this.running || this.ticking) {
      return;
    }

    this.ticking = true;
    this.lastTickAt = new Date().toISOString();

    try {
      const rows = await this.loadDueProgressRows();
      for (const row of rows) {
        await this.processProgressRow(row);
      }
    } catch (error) {
      logger.error('CampaignExecutor tick failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.ticking = false;
    }
  }

  private async loadDueProgressRows(): Promise<CampaignLeadProgressRow[]> {
    let query = supabase
      .from('campaign_lead_progress')
      .select('*')
      .in('status', ['pending', 'waiting', 'in_progress'])
      .order('updated_at', { ascending: true })
      .limit(DEFAULT_BATCH_SIZE);

    if (this.activeCampaignId) {
      query = query.eq('campaign_id', this.activeCampaignId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed loading campaign progress: ${error.message}`);
    }

    const now = Date.now();
    return ((data ?? []) as CampaignLeadProgressRow[]).filter((row) => {
      if (row.status !== 'waiting') return true;
      if (!row.next_action_at) return true;
      return new Date(row.next_action_at).getTime() <= now;
    });
  }

  private async processProgressRow(row: CampaignLeadProgressRow) {
    const [campaign, lead, profile] = await Promise.all([
      this.getCampaign(row.campaign_id),
      this.getLead(row.lead_id),
      this.getProfile(row.profile_id),
    ]);

    if (!campaign || !lead || !profile) {
      await this.markRowFailed(row, 'Campaign context missing');
      return;
    }

    const sequence = this.normalizeSequence(campaign.sequence);
    const step = sequence[row.current_step];

    if (!step) {
      await this.finishRow(row, 'completed', `Sequence complete at step ${row.current_step}`);
      return;
    }

    await supabase
      .from('campaign_lead_progress')
      .update({
        status: 'in_progress',
        last_action_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);

    try {
      const result = await this.executeStep(step, lead, profile.adspower_profile_id ?? null);
      const nextResults = [
        ...(Array.isArray(row.step_results) ? row.step_results : []),
        {
          step: row.current_step,
          result: result.action || (result.success ? 'ok' : 'error'),
          at: new Date().toISOString(),
        },
      ];

      if (!result.success) {
        await supabase
          .from('campaign_lead_progress')
          .update({
            status: 'failed',
            step_results: nextResults,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);
        return;
      }

      if (step.type === 'wait_days') {
        const waitDays = Number(step.config.days || step.config.afterDays || 1);
        const nextActionAt = new Date(Date.now() + Math.max(1, waitDays) * 24 * 60 * 60 * 1000).toISOString();

        await supabase
          .from('campaign_lead_progress')
          .update({
            current_step: row.current_step + 1,
            status: 'waiting',
            next_action_at: nextActionAt,
            step_results: nextResults,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);

        return;
      }

      const nextStep = row.current_step + 1;
      const done = nextStep >= sequence.length;
      await supabase
        .from('campaign_lead_progress')
        .update({
          current_step: nextStep,
          status: done ? 'completed' : 'pending',
          next_action_at: null,
          step_results: nextResults,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
    } catch (error) {
      await this.markRowFailed(row, error instanceof Error ? error.message : String(error));
    }
  }

  private async executeStep(step: CampaignStep, lead: Lead, adspowerProfileId: string | null): Promise<ActionResult> {
    if (step.type === 'wait_days') {
      return { success: true, action: 'wait_days' };
    }

    const page = await this.manager.getPage({ adspowerProfileId });

    if (step.type !== 'visit_profile' && lead.linkedin_url && !page.url().includes('/in/')) {
      await visitProfile(page, { useCurrentLead: true, dwellSeconds: { min: 2, max: 4 } }, lead);
    }

    switch (step.type) {
      case 'visit_profile':
        return visitProfile(page, { ...step.config, useCurrentLead: true }, lead);
      case 'send_connection':
        return sendConnection(page, step.config, lead);
      case 'send_message':
        return sendMessage(page, step.config, lead);
      case 'follow_profile':
        return followProfile(page, step.config, lead);
      case 'check_connected': {
        const res = await checkConnection(page, lead);
        return { ...res, action: res.action === 'yes' ? 'connected' : 'not_connected' };
      }
      case 'withdraw_connection':
        return { success: true, action: 'withdraw_not_implemented' };
      default:
        return { success: true, action: 'noop' };
    }
  }

  private normalizeSequence(raw: unknown): CampaignStep[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((entry, index) => {
        const row = (entry ?? {}) as Record<string, unknown>;
        return {
          id: String(row.id || `step_${index + 1}`),
          type: String(row.type || 'visit_profile') as CampaignStep['type'],
          order: Number(row.order ?? index),
          config: (row.config ?? {}) as CampaignStep['config'],
          label: row.label ? String(row.label) : undefined,
        } satisfies CampaignStep;
      })
      .sort((a, b) => a.order - b.order);
  }

  private async markRowFailed(row: CampaignLeadProgressRow, message: string) {
    logger.warn('Campaign step failed', {
      rowId: row.id,
      campaignId: row.campaign_id,
      leadId: row.lead_id,
      message,
    });
    await supabase
      .from('campaign_lead_progress')
      .update({
        status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
  }

  private async finishRow(row: CampaignLeadProgressRow, status: 'completed' | 'skipped', message: string) {
    logger.info('Campaign row finished', {
      rowId: row.id,
      campaignId: row.campaign_id,
      leadId: row.lead_id,
      status,
      message,
    });
    await supabase
      .from('campaign_lead_progress')
      .update({
        status,
        next_action_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
  }

  private async getCampaign(campaignId: string): Promise<Campaign | null> {
    const { data, error } = await supabase.from('campaigns').select('*').eq('id', campaignId).single();
    if (error) return null;
    return data as Campaign;
  }

  private async getLead(leadId: string): Promise<Lead | null> {
    const { data, error } = await supabase.from('leads').select('*').eq('id', leadId).single();
    if (error) return null;
    return data as Lead;
  }

  private async getProfile(profileId: string): Promise<{ id: string; adspower_profile_id: string | null } | null> {
    const { data, error } = await supabase
      .from('linkedin_profiles')
      .select('id, adspower_profile_id')
      .eq('id', profileId)
      .single();
    if (error) return null;
    return data as { id: string; adspower_profile_id: string | null };
  }

  private async initializeCampaignProgress(campaignId: string) {
    const [{ data: profiles }, { data: folders }] = await Promise.all([
      supabase
        .from('campaign_profiles')
        .select('profile_id')
        .eq('campaign_id', campaignId)
        .eq('status', 'active')
        .limit(1),
      supabase.from('campaign_lead_folders').select('folder_id').eq('campaign_id', campaignId),
    ]);

    const selectedProfileId = profiles?.[0]?.profile_id as string | undefined;
    if (!selectedProfileId) {
      logger.warn('Campaign start skipped seed: no active profile mapping', { campaignId });
      return;
    }

    const folderIds = (folders ?? []).map((row) => String((row as Record<string, unknown>).folder_id));

    let leadsQuery = supabase.from('leads').select('id');
    if (folderIds.length > 0) {
      leadsQuery = leadsQuery.in('folder_id', folderIds);
    }

    const { data: leads, error: leadsError } = await leadsQuery.limit(2000);
    if (leadsError) {
      throw new Error(`Failed loading campaign leads: ${leadsError.message}`);
    }

    const upserts = (leads ?? []).map((entry) => {
      const row = entry as Record<string, unknown>;
      return {
        campaign_id: campaignId,
        lead_id: String(row.id),
        profile_id: selectedProfileId,
        current_step: 0,
        status: 'pending',
        next_action_at: null,
        last_action_at: null,
        step_results: [],
      };
    });

    if (!upserts.length) {
      logger.info('Campaign start seed completed with no eligible leads', { campaignId });
      return;
    }

    const { error } = await supabase
      .from('campaign_lead_progress')
      .upsert(upserts, { onConflict: 'campaign_id,lead_id', ignoreDuplicates: true });
    if (error) {
      throw new Error(`Failed upserting campaign progress seed: ${error.message}`);
    }

    logger.info('Campaign progress seeded', {
      campaignId,
      leads: upserts.length,
      profileId: selectedProfileId,
    });
  }
}

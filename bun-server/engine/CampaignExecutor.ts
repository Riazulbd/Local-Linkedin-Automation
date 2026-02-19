import { randomUUID } from 'node:crypto';
import { supabase } from '../lib/supabase';
import { Logger } from '../lib/logger';
import { checkConnection } from './actions/checkConnection';
import { followProfile } from './actions/followProfile';
import { executeConnectAction } from './actions/sendConnection';
import { sendMessage } from './actions/sendMessage';
import { syncInbox } from './actions/syncInbox';
import { visitProfile } from './actions/visitProfile';
import {
  injectCursor,
  visionCheckConnectionAccepted,
  visionFollowProfile,
  visionSendConnection,
} from './helpers/visionClicker';
import { dismissPopups, detectLoggedOut } from './helpers/linkedinGuard';
import { betweenLeadsPause, actionPause, randomBetween } from './helpers/humanBehavior';
import { interpolate } from './helpers/templateEngine';
import { browserSessionManager } from './BrowserSessionManager';
import { SessionHealer } from './SessionHealer';
import { LiveEventLogger } from '../lib/LiveEventLogger';
import type { CampaignStep, Lead } from '../../types';

// Active execution abort map keyed by profileId.
const abortMap = new Map<string, boolean>();

export function requestAbort(profileId: string) {
  abortMap.set(profileId, true);
}

export function clearAbort(profileId: string) {
  abortMap.delete(profileId);
}

function isAborted(profileId: string): boolean {
  return abortMap.get(profileId) === true;
}

interface ProgressWithLead {
  campaign_id: string;
  lead_id: string;
  profile_id: string;
  current_step: number;
  status: string;
  next_action_at: string | null;
  leads: Lead | null;
}

async function prepareProfileForVision(
  page: import('playwright').Page,
  lead: Lead,
  liveLogger: LiveEventLogger
) {
  const profileUrl = typeof lead.linkedin_url === 'string' ? lead.linkedin_url.trim() : '';
  if (!profileUrl) {
    throw new Error('Lead linkedin_url is missing');
  }

  await liveLogger.emit('navigation', `Navigating to ${profileUrl}`);
  await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('h1', { timeout: 12000 });
  const h1Text = (await page.locator('h1').first().textContent().catch(() => '')) || '';
  await liveLogger.emit('page_ready', `Profile loaded — "${h1Text.trim()}"`, { url: page.url() });
  await page.waitForTimeout(3000);
  await injectCursor(page);
}

export async function runCampaignForProfile(
  campaignId: string,
  profileId: string,
  adspowerProfileId: string,
  runId: string
): Promise<void> {
  const logger = new Logger(runId);
  const sessionHealer = new SessionHealer();
  clearAbort(profileId);

  const { data: steps } = await supabase
    .from('campaign_steps')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('step_order', { ascending: true });

  if (!steps || steps.length === 0) {
    await logger.log('campaign', 'campaign', 'error', 'No steps defined');
    return;
  }

  const now = new Date().toISOString();
  const { data: dueLeads } = await supabase
    .from('campaign_lead_progress')
    .select('campaign_id, lead_id, profile_id, current_step, status, next_action_at, leads(*)')
    .eq('campaign_id', campaignId)
    .eq('profile_id', profileId)
    .in('status', ['pending', 'waiting', 'active'])
    .or(`next_action_at.is.null,next_action_at.lte.${now}`)
    .limit(25);

  if (!dueLeads || dueLeads.length === 0) {
    await logger.log('campaign', 'campaign', 'success', 'No leads due for action');
    return;
  }

  let page: import('playwright').Page | null = null;

  try {
    page = await browserSessionManager.getSession(profileId, adspowerProfileId);

    const sessionReady = await sessionHealer.healSession(profileId, adspowerProfileId, page);
    if (!sessionReady) {
      await logger.log(
        'session',
        'campaign',
        'error',
        'LinkedIn session invalid after warmup/heal'
      );
      await supabase
        .from('linkedin_profiles')
        .update({ login_status: 'error' })
        .eq('id', profileId);
      return;
    }

    try {
      await syncInbox(page, profileId);
    } catch (syncError) {
      await logger.log(
        'unibox',
        'campaign',
        'error',
        `Inbox sync skipped: ${syncError instanceof Error ? syncError.message : String(syncError)}`
      );
    }

    await supabase
      .from('linkedin_profiles')
      .update({ status: 'running' })
      .eq('id', profileId);

    for (const row of dueLeads as unknown as ProgressWithLead[]) {
      if (isAborted(profileId)) {
        await logger.log('campaign', 'campaign', 'skipped', 'Execution aborted by user');
        break;
      }

      const lead = row.leads as Lead | null;
      if (!lead) continue;

      if (await detectLoggedOut(page)) {
        await logger.log('session', 'campaign', 'running', 'Session expired - healing', lead.id);
        const healed = await sessionHealer.healSession(profileId, adspowerProfileId, page);
        if (!healed) {
          await logger.log('session', 'campaign', 'error', 'Session healing failed - stopping', lead.id);
          await supabase
            .from('linkedin_profiles')
            .update({ login_status: 'logged_out' })
            .eq('id', profileId);
          break;
        }
      }

      await logger.log(
        `lead-${lead.id}`,
        'campaign',
        'running',
        `Processing: ${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
        lead.id
      );

      await executeStepsForLead(
        page,
        lead,
        steps as CampaignStep[],
        row.current_step,
        campaignId,
        profileId,
        runId
      );

      await betweenLeadsPause(10, 35);
    }
  } catch (error) {
    await logger.log(
      'campaign',
      'campaign',
      'error',
      `Fatal: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    await supabase
      .from('linkedin_profiles')
      .update({ status: 'idle' })
      .eq('id', profileId);
  }
}

async function executeStepsForLead(
  page: import('playwright').Page,
  lead: Lead,
  steps: CampaignStep[],
  startStep: number,
  campaignId: string,
  profileId: string,
  runId: string
) {
  const logger = new Logger(runId);
  let currentStepIdx = startStep;

  while (currentStepIdx < steps.length) {
    const step = steps.find((entry) => entry.step_order === currentStepIdx);
    if (!step) {
      break;
    }

    await dismissPopups(page);

    let result: any = { success: false };

    try {
      switch (step.step_type) {
        case 'visit_profile':
          result = await visitProfile(page, { useCurrentLead: true }, lead);
          break;

        case 'follow_profile':
          {
            const liveLogger = new LiveEventLogger(supabase as any, runId, lead.id);
            try {
              await prepareProfileForVision(page, lead, liveLogger);
              result = await visionFollowProfile(page, lead, supabase as any, liveLogger);
              if (!result.success) {
                throw new Error(result.error || 'Vision follow failed');
              }
            } catch (error) {
              await liveLogger.emit(
                'action_failed',
                `Vision follow failed — using fallback: ${error instanceof Error ? error.message : String(error)}`
              );
              result = await followProfile(page);
            }
          }
          break;

        case 'send_connection': {
          const liveLogger = new LiveEventLogger(supabase as any, runId, lead.id);
          try {
            await prepareProfileForVision(page, lead, liveLogger);
            result = await visionSendConnection(page, lead, supabase as any, liveLogger);
            if (!result.success) {
              throw new Error(result.error || 'Vision connect failed');
            }
          } catch (error) {
            await liveLogger.emit(
              'action_failed',
              `Vision connect failed — using fallback: ${error instanceof Error ? error.message : String(error)}`
            );
            result = await executeConnectAction(page, lead, supabase as any, undefined, runId);
          }
          break;
        }

        case 'send_message': {
          const rawMessage = String(step.config.message || '');
          const message = interpolate(rawMessage, lead);
          result = await sendMessage(page, { message }, lead);
          break;
        }

        case 'check_connection': {
          const liveLogger = new LiveEventLogger(supabase as any, runId, lead.id);
          try {
            result = await visionCheckConnectionAccepted(page, lead, supabase as any, liveLogger);
            if (!result.success) {
              throw new Error(result.error || 'Vision connection check failed');
            }
          } catch (error) {
            await liveLogger.emit(
              'action_failed',
              `Vision check failed — using fallback: ${error instanceof Error ? error.message : String(error)}`
            );
            try {
              await prepareProfileForVision(page, lead, liveLogger);
            } catch {
              // best effort before fallback checker
            }
            result = await checkConnection(page);
          }
          if (!result.isConnected && step.config.notConnectedGoToStep !== undefined) {
            currentStepIdx = Number(step.config.notConnectedGoToStep);
            continue;
          }
          break;
        }

        case 'wait_days': {
          const days = Number(step.config.days || 3);
          const minHours = Number(step.config.minHours || days * 24 - 4);
          const maxHours = Number(step.config.maxHours || days * 24 + 4);
          const waitMs = randomBetween(minHours * 3600 * 1000, maxHours * 3600 * 1000);
          const nextAt = new Date(Date.now() + waitMs).toISOString();

          await supabase
            .from('campaign_lead_progress')
            .update({
              current_step: currentStepIdx + 1,
              status: 'waiting',
              next_action_at: nextAt,
              last_action_at: new Date().toISOString(),
            })
            .eq('campaign_id', campaignId)
            .eq('lead_id', lead.id);

          await logger.log(
            step.id,
            step.step_type,
            'success',
            `Waiting ${days} days - next action: ${nextAt}`,
            lead.id
          );

          return;
        }

        default:
          result = { success: true, action: 'noop' };
      }
    } catch (error) {
      result = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    if (result.error === 'SESSION_EXPIRED' || result.error === 'RATE_LIMITED') {
      await logger.log(step.id, step.step_type, 'error', result.error, lead.id);
      await supabase
        .from('campaign_lead_progress')
        .update({
          status: 'failed',
          last_action_at: new Date().toISOString(),
        })
        .eq('campaign_id', campaignId)
        .eq('lead_id', lead.id);

      return;
    }

    await logger.log(
      step.id,
      step.step_type,
      result.success ? 'success' : 'error',
      result.action || result.error || 'done',
      lead.id
    );

    if (!result.success) {
      await supabase
        .from('campaign_lead_progress')
        .update({
          status: 'failed',
          last_action_at: new Date().toISOString(),
        })
        .eq('campaign_id', campaignId)
        .eq('lead_id', lead.id);

      return;
    }

    currentStepIdx += 1;
    await actionPause();
  }

  await supabase
    .from('campaign_lead_progress')
    .update({
      current_step: steps.length,
      status: 'completed',
      last_action_at: new Date().toISOString(),
      next_action_at: null,
    })
    .eq('campaign_id', campaignId)
    .eq('lead_id', lead.id);
}

interface CampaignSchedulerRow {
  id: string;
  folder_id: string | null;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  daily_new_leads: number;
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

const DEFAULT_TICK_MS = Number(process.env.CAMPAIGN_TICK_MS || 60000);

export class CampaignExecutor {
  private interval: NodeJS.Timeout | null = null;
  private running = false;
  private ticking = false;
  private activeCampaignId: string | null = null;
  private lastTickAt: string | null = null;

  async start(options: StartOptions = {}) {
    if (this.running) {
      return { started: false, reason: 'already_running', status: this.getStatus() };
    }

    this.running = true;
    this.activeCampaignId = options.campaignId ?? null;

    if (this.activeCampaignId) {
      await supabase
        .from('campaigns')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', this.activeCampaignId);
    }

    this.interval = setInterval(() => {
      void this.tick();
    }, DEFAULT_TICK_MS);

    await this.tick();

    return { started: true, status: this.getStatus() };
  }

  async stop(options: StartOptions = {}) {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.running = false;

    if (options.campaignId) {
      await supabase
        .from('campaigns')
        .update({ status: 'paused', updated_at: new Date().toISOString() })
        .eq('id', options.campaignId);
    }

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
      let query = supabase
        .from('campaigns')
        .select('id, folder_id, status, daily_new_leads')
        .eq('status', 'active')
        .order('updated_at', { ascending: true });

      if (this.activeCampaignId) {
        query = query.eq('id', this.activeCampaignId);
      }

      const { data: campaigns } = await query;

      for (const campaign of (campaigns ?? []) as CampaignSchedulerRow[]) {
        if (!this.running) break;

        await this.seedCampaignProgress(campaign);

        const { data: attachedProfiles } = await supabase
          .from('campaign_profiles')
          .select('profile_id, is_active, linkedin_profiles(adspower_profile_id)')
          .eq('campaign_id', campaign.id)
          .eq('is_active', true);

        for (const mapping of attachedProfiles ?? []) {
          if (!this.running) break;

          const profileId = String((mapping as any).profile_id || '');
          const adspowerProfileId = String((mapping as any).linkedin_profiles?.adspower_profile_id || '');

          if (!profileId || !adspowerProfileId) {
            continue;
          }

          const runId = randomUUID();
          await runCampaignForProfile(campaign.id, profileId, adspowerProfileId, runId);
        }
      }
    } catch (error) {
      const logger = new Logger();
      await logger.log(
        'campaign_scheduler',
        'campaign',
        'error',
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      this.ticking = false;
    }
  }

  private async seedCampaignProgress(campaign: CampaignSchedulerRow): Promise<void> {
    if (!campaign.folder_id) {
      return;
    }

    const { data: profileRows } = await supabase
      .from('campaign_profiles')
      .select('profile_id')
      .eq('campaign_id', campaign.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    const profileIds = (profileRows ?? []).map((entry) => String((entry as any).profile_id || '')).filter(Boolean);
    if (!profileIds.length) {
      return;
    }

    const { data: existingRows } = await supabase
      .from('campaign_lead_progress')
      .select('lead_id')
      .eq('campaign_id', campaign.id);

    const existingLeadIds = new Set((existingRows ?? []).map((entry) => String((entry as any).lead_id || '')));

    const { data: folderLeads } = await supabase
      .from('leads')
      .select('id')
      .eq('folder_id', campaign.folder_id)
      .order('created_at', { ascending: true })
      .limit(5000);

    const candidates = (folderLeads ?? [])
      .map((entry) => String((entry as any).id || ''))
      .filter((leadId) => Boolean(leadId) && !existingLeadIds.has(leadId));

    if (!candidates.length) {
      return;
    }

    const rows: Array<Record<string, unknown>> = [];
    for (let i = 0; i < candidates.length; i += 1) {
      const profileId = profileIds[i % profileIds.length];
      rows.push({
        campaign_id: campaign.id,
        lead_id: candidates[i],
        profile_id: profileId,
        current_step: 0,
        status: 'pending',
      });
    }

    await supabase
      .from('campaign_lead_progress')
      .upsert(rows, { onConflict: 'campaign_id,lead_id', ignoreDuplicates: true });

    await supabase
      .from('campaigns')
      .update({ total_leads: existingLeadIds.size + rows.length, updated_at: new Date().toISOString() })
      .eq('id', campaign.id);
  }
}

import type { Page } from 'playwright';
import { PlaywrightManager, type PlaywrightLaunchOptions } from './PlaywrightManager';
import { visitProfile } from './actions/visitProfile';
import { followProfile } from './actions/followProfile';
import { sendMessage } from './actions/sendMessage';
import { sendConnection } from './actions/sendConnection';
import { checkConnection } from './actions/checkConnection';
import { waitDelay } from './actions/waitDelay';
import { getSupabaseClient } from '../supabase';
import { RateLimiter } from './helpers/rateLimiter';
import { logger } from '../logger';
import type { ActionResult, Lead, WorkflowEdge, WorkflowNode } from '../../types';

interface StartPayload {
  workflowId: string;
  linkedinProfileId: string;
  leads: Lead[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

interface AutomationProfileContext {
  id: string;
  adspowerProfileId: string | null;
}

const DAILY_LIMITS: Record<string, number> = {
  send_message: 80,
  send_connection: 40,
  follow_profile: 100,
};

export class WorkflowExecutor {
  private manager = new PlaywrightManager();
  private rateLimiter = new RateLimiter();
  private isRunning = false;
  private shouldStop = false;
  private currentRunId: string | null = null;
  private runPromise: Promise<void> | null = null;
  private supabase: ReturnType<typeof getSupabaseClient> | null = null;

  private getSupabase() {
    if (!this.supabase) {
      this.supabase = getSupabaseClient();
    }
    return this.supabase;
  }

  private async launchPageWithTimeout(timeoutMs = 120000, launchOptions: PlaywrightLaunchOptions = {}): Promise<Page> {
    const isAdsPower = Boolean(launchOptions.adspowerProfileId);
    const timeoutHint = isAdsPower
      ? 'AdsPower browser boot can take longer; confirm AdsPower is running and CDP debug port is reachable from bun-server.'
      : 'Verify bun-server can launch Chromium in the current runtime.';

    return (await Promise.race([
      this.manager.getPage(launchOptions),
      new Promise<Page>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              `Timed out opening browser session after ${Math.round(timeoutMs / 1000)}s. ${timeoutHint}`
            )
          );
        }, timeoutMs);
      }),
    ])) as Page;
  }

  private async getAutomationProfileContext(linkedinProfileId: string): Promise<AutomationProfileContext> {
    const { data, error } = await this.getSupabase()
      .from('linkedin_profiles')
      .select('id, adspower_profile_id')
      .eq('id', linkedinProfileId)
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'LinkedIn profile not found');
    }

    return {
      id: String((data as Record<string, unknown>).id),
      adspowerProfileId:
        (data as Record<string, unknown>).adspower_profile_id == null
          ? null
          : String((data as Record<string, unknown>).adspower_profile_id),
    };
  }

  async start({ workflowId, linkedinProfileId, leads, nodes, edges }: StartPayload) {
    if (this.isRunning) {
      throw new Error('Automation is already running');
    }

    if (!workflowId) {
      throw new Error('Missing workflowId');
    }

    if (!linkedinProfileId) {
      throw new Error('Missing linkedinProfileId');
    }

    if (!Array.isArray(leads) || !leads.length) {
      throw new Error('No leads to process');
    }

    const profileContext = await this.getAutomationProfileContext(linkedinProfileId);

    this.isRunning = true;
    this.shouldStop = false;

    const supabase = this.getSupabase();

    const { data: run, error } = await supabase
      .from('execution_runs')
      .insert({
        profile_id: linkedinProfileId,
        workflow_id: workflowId,
        status: 'running',
        leads_total: leads.length,
      })
      .select('*')
      .single();

    if (error || !run) {
      this.isRunning = false;
      throw new Error(error?.message || 'Failed to create execution run');
    }

    this.currentRunId = run.id;

    logger.info('Starting execution run', {
      runId: run.id,
      workflowId,
      linkedinProfileId,
      leads: leads.length,
      adspowerProfileId: profileContext.adspowerProfileId,
    });

    this.runPromise = this.executeRun({
      leads,
      nodes,
      edges,
      runId: run.id,
      profileContext,
    }).catch((runError) => {
      logger.error('Execution run failed', {
        runId: run.id,
        error: runError instanceof Error ? runError.message : String(runError),
      });
    });

    return run.id;
  }

  private async executeRun({
    leads,
    nodes,
    edges,
    runId,
    profileContext,
  }: {
    leads: Lead[];
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    runId: string;
    profileContext: AutomationProfileContext;
  }) {
    const supabase = this.getSupabase();
    let completed = 0;
    let failed = 0;

    try {
      const page = await this.launchPageWithTimeout(120000, {
        adspowerProfileId: profileContext.adspowerProfileId,
      });

      for (const lead of leads) {
        if (this.shouldStop) break;

        await supabase
          .from('leads')
          .update({ status: 'running', updated_at: new Date().toISOString() })
          .eq('id', lead.id);

        await this.log(
          lead.id,
          'loop_leads',
          'loop_leads',
          'running',
          `Starting lead ${lead.first_name || ''} ${lead.last_name || ''}`.trim()
        );

        try {
          await this.executeNodes(page, nodes, edges, lead);

          completed += 1;
          await supabase
            .from('leads')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', lead.id);
        } catch (error) {
          failed += 1;
          await supabase
            .from('leads')
            .update({ status: 'failed', updated_at: new Date().toISOString() })
            .eq('id', lead.id);

          await this.log(
            lead.id,
            'error',
            'error',
            'error',
            error instanceof Error ? error.message : 'Unexpected node execution error'
          );
        }

        await supabase
          .from('execution_runs')
          .update({ leads_completed: completed, leads_failed: failed })
          .eq('id', runId);

        if (!this.shouldStop) {
          const interLeadDelay = 8000 + Math.random() * 12000;
          await this.log(
            lead.id,
            'wait_delay',
            'wait_delay',
            'success',
            `Waiting ${Math.round(interLeadDelay / 1000)}s before next lead`
          );
          await new Promise((resolve) => setTimeout(resolve, interLeadDelay));
        }
      }

      await supabase
        .from('execution_runs')
        .update({
          status: this.shouldStop ? 'stopped' : 'completed',
          leads_completed: completed,
          leads_failed: failed,
          completed_at: new Date().toISOString(),
        })
        .eq('id', runId);
    } catch (error) {
      await this.log(
        null,
        'system',
        'system',
        'error',
        error instanceof Error ? error.message : 'Execution failed before workflow steps started'
      );

      await supabase
        .from('execution_runs')
        .update({
          status: 'failed',
          leads_completed: completed,
          leads_failed: failed,
          completed_at: new Date().toISOString(),
        })
        .eq('id', runId);

      throw error;
    } finally {
      this.isRunning = false;
      this.shouldStop = false;
      await this.manager.cleanup();
    }
  }

  private async executeNodes(page: Page, nodes: WorkflowNode[], edges: WorkflowEdge[], lead: Lead) {
    if (!nodes.length) return;

    const startingNode =
      nodes.find((node) => node.type === 'loop_leads') ||
      nodes.find((node) => !edges.some((edge) => edge.target === node.id)) ||
      nodes[0];

    let currentNode: WorkflowNode | null | undefined = startingNode;
    let safetyCounter = 0;

    while (currentNode && !this.shouldStop) {
      safetyCounter += 1;
      if (safetyCounter > 500) {
        throw new Error('Workflow exceeded maximum step count (possible cycle without exit)');
      }

      const result = await this.executeNode(page, currentNode, lead);

      const outgoing = edges.filter((edge) => edge.source === currentNode!.id);
      let nextEdge: WorkflowEdge | undefined;

      if (currentNode.type === 'if_condition') {
        nextEdge = outgoing.find((edge) => edge.sourceHandle === result.action) || outgoing[0];
      } else {
        nextEdge = outgoing[0];
      }

      currentNode = nextEdge ? nodes.find((node) => node.id === nextEdge.target) || null : null;
    }
  }

  private async executeNode(page: Page, node: WorkflowNode, lead: Lead): Promise<ActionResult> {
    await this.log(lead.id, node.id, node.type, 'running', `Executing ${node.type}`);

    const limit = DAILY_LIMITS[node.type];
    if (limit && !this.rateLimiter.canPerform(node.type, limit)) {
      const message = `Daily limit reached for ${node.type}`;
      await this.log(lead.id, node.id, node.type, 'skipped', message);
      return { success: false, action: 'rate_limited', error: message };
    }

    let result: ActionResult;

    switch (node.type) {
      case 'loop_leads':
        result = { success: true, action: 'next' };
        break;
      case 'visit_profile':
        result = await visitProfile(page, node.data, lead);
        break;
      case 'follow_profile':
        result = await followProfile(page, node.data, lead);
        break;
      case 'send_message':
        result = await sendMessage(page, node.data, lead);
        break;
      case 'send_connection':
        result = await sendConnection(page, node.data, lead);
        break;
      case 'check_connection':
        result = await checkConnection(page, lead);
        break;
      case 'wait_delay':
        result = await waitDelay(node.data);
        break;
      case 'if_condition':
        result = await this.evaluateCondition(page, node, lead);
        break;
      default:
        result = { success: true, action: 'next' };
    }

    if (result.success && DAILY_LIMITS[node.type]) {
      this.rateLimiter.record(node.type);
    }

    await this.log(
      lead.id,
      node.id,
      node.type,
      result.success ? 'success' : 'error',
      result.action || result.error || 'Done',
      result.data || {}
    );

    if (!result.success && node.type !== 'if_condition') {
      throw new Error(result.error || `Node ${node.type} failed`);
    }

    return result;
  }

  private async evaluateCondition(page: Page, node: WorkflowNode, lead: Lead): Promise<ActionResult> {
    const condition = (node.data.condition || 'connection_status').trim();
    const expected = (node.data.conditionValue || '').trim().toLowerCase();

    if (condition === 'connection_status') {
      const statusResult = await checkConnection(page, lead);
      const actualStatus = String(statusResult.data?.status || '').toLowerCase();
      const conditionMet = expected ? actualStatus === expected : statusResult.action === 'yes';

      return {
        success: true,
        action: conditionMet ? 'yes' : 'no',
        data: { condition, expected: expected || 'connected/following/pending', actual: actualStatus },
      };
    }

    const leadRecord = lead as unknown as Record<string, unknown>;
    const leadValue = String(leadRecord[condition] || '').toLowerCase();
    const conditionMet = expected ? leadValue.includes(expected) : Boolean(leadValue);

    return {
      success: true,
      action: conditionMet ? 'yes' : 'no',
      data: { condition, expected, actual: leadValue },
    };
  }

  private async log(
    leadId: string | null,
    nodeId: string,
    nodeType: string,
    status: 'running' | 'success' | 'error' | 'skipped',
    message: string,
    resultData: Record<string, unknown> = {}
  ) {
    if (!this.currentRunId) return;

    if (this.currentRunId.startsWith('test_')) {
      logger.debug('Node test log', {
        nodeId,
        nodeType,
        status,
        message,
      });
      return;
    }

    const { error } = await this.getSupabase().from('execution_logs').insert({
      run_id: this.currentRunId,
      lead_id: leadId,
      node_id: nodeId,
      node_type: nodeType,
      status,
      message,
      result_data: resultData,
    });

    if (error) {
      logger.warn('Failed to insert execution log', {
        runId: this.currentRunId,
        nodeId,
        error: error.message,
      });
    }
  }

  async testNode({
    nodeType,
    nodeData,
    linkedinUrl,
    linkedinProfileId,
  }: {
    nodeType: string;
    nodeData: Record<string, unknown>;
    nodeId?: string;
    linkedinUrl: string;
    linkedinProfileId?: string;
  }) {
    const testRunId = `test_${Date.now()}`;
    this.currentRunId = testRunId;

    const profileContext =
      linkedinProfileId && typeof linkedinProfileId === 'string'
        ? await this.getAutomationProfileContext(linkedinProfileId)
        : null;

    try {
      await this.log(null, 'test_init', 'test', 'running', `Starting test for ${nodeType}...`);

      if (nodeType === 'wait_delay') {
        const res = await waitDelay(nodeData);
        await this.log(
          null,
          'test_wait',
          'wait_delay',
          res.success ? 'success' : 'error',
          (res as any).action || (res as any).error || 'Wait completed'
        );
        return res;
      }

      const page = await this.launchPageWithTimeout(90000, {
        adspowerProfileId: profileContext?.adspowerProfileId,
      });
      const fakeLead: Lead = {
        id: 'test',
        profile_id: linkedinProfileId || 'test',
        linkedin_url: linkedinUrl,
        first_name: 'Test',
        last_name: 'User',
        company: 'Example',
        title: 'Operator',
        extra_data: {},
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const nodeTypesNeedingProfileContext = new Set([
        'follow_profile',
        'send_message',
        'send_connection',
        'check_connection',
      ]);

      if (nodeTypesNeedingProfileContext.has(nodeType)) {
        await this.log(fakeLead.id, 'test_visit', 'visit_profile', 'running', 'Visiting profile for context...');
        await visitProfile(page, { useCurrentLead: true }, fakeLead);
        await page.waitForTimeout(1500);
      }

      await this.log(fakeLead.id, 'test_action', nodeType, 'running', `Executing ${nodeType} action...`);

      let result: ActionResult;
      switch (nodeType) {
        case 'visit_profile':
          result = await visitProfile(page, { useCurrentLead: true }, fakeLead);
          break;
        case 'follow_profile':
          result = await followProfile(page, nodeData, fakeLead);
          break;
        case 'send_message':
          result = await sendMessage(page, nodeData, fakeLead);
          break;
        case 'send_connection':
          result = await sendConnection(page, nodeData, fakeLead);
          break;
        case 'check_connection':
          result = await checkConnection(page, fakeLead);
          break;
        default:
          result = { success: true, action: 'no_action' };
      }

      await this.log(
        fakeLead.id,
        'test_result',
        nodeType,
        result.success ? 'success' : 'error',
        result.action || result.error || 'Test finished',
        result.data
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Test failed';
      await this.log(null, 'test_error', 'error', 'error', errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setTimeout(() => {
        if (this.currentRunId === testRunId) {
          this.currentRunId = null;
        }
      }, 5000);
    }
  }

  async stop() {
    this.shouldStop = true;
    logger.info('Stop requested for active execution run', {
      runId: this.currentRunId,
    });
    return { stopping: true };
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      runId: this.currentRunId,
      shouldStop: this.shouldStop,
      limits: this.rateLimiter.snapshot(),
    };
  }
}

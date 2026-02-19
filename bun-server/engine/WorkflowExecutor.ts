import type { Page } from 'playwright';
import { PlaywrightManager, type PlaywrightLaunchOptions } from './PlaywrightManager';
import { visitProfile } from './actions/visitProfile';
import { followProfile } from './actions/followProfile';
import { sendMessage } from './actions/sendMessage';
import { executeConnectAction } from './actions/sendConnection';
import { checkConnection } from './actions/checkConnection';
import { waitDelay } from './actions/waitDelay';
import { syncInbox } from './actions/syncInbox';
import {
  injectCursor,
  visionCheckConnectionAccepted,
  visionFollowProfile,
  visionSendConnection,
} from './helpers/visionClicker';
import { getSupabaseClient } from '../supabase';
import { RateLimiter } from './helpers/rateLimiter';
import { logger } from '../logger';
import { Logger as LiveRunLogger } from '../lib/logger';
import { LiveEventLogger } from '../lib/LiveEventLogger';
import { browserSessionManager } from './BrowserSessionManager';
import { SessionHealer } from './SessionHealer';
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
  private sessionHealer = new SessionHealer();
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

  private async hasStoredCredentials(profileId: string): Promise<boolean> {
    const { data, error } = await this.getSupabase()
      .from('linkedin_profiles')
      .select('linkedin_email_encrypted, linkedin_password_encrypted, linkedin_email_login, linkedin_password_enc')
      .eq('id', profileId)
      .maybeSingle();

    if (error || !data) return false;
    const row = data as Record<string, unknown>;
    const hasNew =
      typeof row.linkedin_email_encrypted === 'string' &&
      row.linkedin_email_encrypted.length > 0 &&
      typeof row.linkedin_password_encrypted === 'string' &&
      row.linkedin_password_encrypted.length > 0;
    const hasLegacy =
      typeof row.linkedin_email_login === 'string' &&
      row.linkedin_email_login.length > 0 &&
      typeof row.linkedin_password_enc === 'string' &&
      row.linkedin_password_enc.length > 0;
    return hasNew || hasLegacy;
  }

  private async prepareProfileForVision(
    page: Page,
    lead: Lead,
    liveLogger: LiveEventLogger
  ): Promise<void> {
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
    const usePersistentSession = Boolean(profileContext.adspowerProfileId);

    try {
      const page = usePersistentSession
        ? await browserSessionManager.getSession(profileContext.id, profileContext.adspowerProfileId!)
        : await this.launchPageWithTimeout(120000, {
            adspowerProfileId: profileContext.adspowerProfileId,
          });

      if (usePersistentSession) {
        const healed = await this.sessionHealer.healSession(
          profileContext.id,
          profileContext.adspowerProfileId!,
          page
        );
        if (!healed) {
          throw new Error('LinkedIn login failed before workflow execution (session healer failed)');
        }

        await syncInbox(page, profileContext.id).catch(() => undefined);
      }

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
      if (!usePersistentSession) {
        await this.manager.cleanup();
      }
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

  private async executeNodePathForTest(
    page: Page,
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    startNodeId: string,
    lead: Lead,
    isTest: boolean
  ): Promise<{
    success: boolean;
    nodeResults: Array<{
      nodeId: string;
      nodeType: string;
      status: 'success' | 'error' | 'skipped';
      message: string;
    }>;
  }> {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    let currentNode = nodeById.get(startNodeId) || null;
    let safetyCounter = 0;
    const nodeResults: Array<{
      nodeId: string;
      nodeType: string;
      status: 'success' | 'error' | 'skipped';
      message: string;
    }> = [];

    if (!currentNode) {
      return {
        success: false,
        nodeResults: [
          {
            nodeId: startNodeId,
            nodeType: 'unknown',
            status: 'error',
            message: 'Start node not found in workflow graph',
          },
        ],
      };
    }

    while (currentNode && !this.shouldStop) {
      const activeNode: WorkflowNode = currentNode;
      safetyCounter += 1;
      if (safetyCounter > 500) {
        nodeResults.push({
          nodeId: activeNode.id,
          nodeType: activeNode.type,
          status: 'error',
          message: 'Safety limit reached (possible cycle)',
        });
        break;
      }

      let result: ActionResult;
      let resultStatus: 'success' | 'error' | 'skipped' = 'success';

      try {
        result = await this.executeNode(page, activeNode, lead);
        if (result.action === 'rate_limited') {
          resultStatus = 'skipped';
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Node execution failed';
        result = { success: false, error: message, action: 'node_error' };
        resultStatus = 'error';

        await this.log(
          lead.id,
          activeNode.id,
          activeNode.type,
          'error',
          `Node failed in path test: ${message}`,
          {},
          isTest
        );
      }

      nodeResults.push({
        nodeId: activeNode.id,
        nodeType: activeNode.type,
        status: resultStatus,
        message: result.error || result.action || 'Done',
      });

      const outgoing: WorkflowEdge[] = edges.filter((edge: WorkflowEdge) => edge.source === activeNode.id);
      let nextEdge: WorkflowEdge | undefined;

      if (activeNode.type === 'if_condition') {
        nextEdge = outgoing.find((edge: WorkflowEdge) => edge.sourceHandle === result.action) || outgoing[0];
      } else {
        nextEdge = outgoing[0];
      }

      currentNode = nextEdge ? nodeById.get(nextEdge.target) || null : null;
    }

    return {
      success: nodeResults.every((row) => row.status !== 'error'),
      nodeResults,
    };
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
        {
          const liveLogger = new LiveEventLogger(this.getSupabase() as any, this.currentRunId || null, lead.id);
          try {
            await this.prepareProfileForVision(page, lead, liveLogger);
            result = await visionFollowProfile(page, lead, this.getSupabase() as any, liveLogger);
            if (!result.success) {
              throw new Error(result.error || 'Vision follow failed');
            }
          } catch (error) {
            await liveLogger.emit(
              'action_failed',
              `Vision follow failed — using fallback: ${error instanceof Error ? error.message : String(error)}`
            );
            result = await followProfile(page, node.data, lead);
          }
        }
        break;
      case 'send_message':
        result = await sendMessage(page, node.data, lead);
        break;
      case 'send_connection':
        {
          const liveLogger = new LiveEventLogger(this.getSupabase() as any, this.currentRunId || null, lead.id);
          try {
            await this.prepareProfileForVision(page, lead, liveLogger);
            result = await visionSendConnection(page, lead, this.getSupabase() as any, liveLogger);
            if (!result.success) {
              throw new Error(result.error || 'Vision connect failed');
            }
          } catch (error) {
            await liveLogger.emit(
              'action_failed',
              `Vision connect failed — using fallback: ${error instanceof Error ? error.message : String(error)}`
            );
            result = await executeConnectAction(
              page,
              lead,
              this.getSupabase() as any,
              undefined,
              this.currentRunId || undefined
            );
          }
        }
        break;
      case 'check_connection':
        {
          const liveLogger = new LiveEventLogger(this.getSupabase() as any, this.currentRunId || null, lead.id);
          try {
            result = await visionCheckConnectionAccepted(page, lead, this.getSupabase() as any, liveLogger);
            if (!result.success) {
              throw new Error(result.error || 'Vision connection check failed');
            }
          } catch (error) {
            await liveLogger.emit(
              'action_failed',
              `Vision check failed — using fallback: ${error instanceof Error ? error.message : String(error)}`
            );
            try {
              await this.prepareProfileForVision(page, lead, liveLogger);
            } catch {
              // best effort before fallback checker
            }
            result = await checkConnection(page, lead);
          }
        }
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
    const leadRecord = lead as unknown as Record<string, unknown>;

    if (condition === 'connection_status') {
      const statusResult = await checkConnection(page, lead);
      const actualStatus = statusResult.isConnected ? 'connected' : 'not_connected';
      const conditionMet = expected ? actualStatus === expected : statusResult.isConnected;

      return {
        success: true,
        action: conditionMet ? 'yes' : 'no',
        data: { condition, expected: expected || 'connected', actual: actualStatus },
      };
    }

    if (condition === 'connection_accepted') {
      const actual = Boolean(leadRecord.connection_accepted);
      const expectedBool = expected ? expected === 'true' : true;
      return {
        success: true,
        action: actual === expectedBool ? 'yes' : 'no',
        data: { condition, expected: String(expectedBool), actual: String(actual) },
      };
    }

    if (condition === 'connection_degree_detected') {
      const actual = String(
        leadRecord.connection_degree_detected ?? leadRecord.connection_degree ?? 'unknown'
      ).toLowerCase();
      const target = expected || '1st';
      return {
        success: true,
        action: actual === target ? 'yes' : 'no',
        data: { condition, expected: target, actual },
      };
    }

    if (condition === 'last_action_taken') {
      const actual = String(leadRecord.last_action_taken ?? 'none').toLowerCase();
      const target = expected || 'none';
      return {
        success: true,
        action: actual === target ? 'yes' : 'no',
        data: { condition, expected: target, actual },
      };
    }

    if (condition === 'visit_count_gt' || condition === 'visit_count_lt') {
      const actualVisitCount = Number(leadRecord.visit_count ?? 0);
      const threshold = Number(expected || '0');
      const normalizedActual = Number.isFinite(actualVisitCount) ? actualVisitCount : 0;
      const normalizedThreshold = Number.isFinite(threshold) ? threshold : 0;
      const met =
        condition === 'visit_count_gt'
          ? normalizedActual > normalizedThreshold
          : normalizedActual < normalizedThreshold;

      return {
        success: true,
        action: met ? 'yes' : 'no',
        data: {
          condition,
          expected: normalizedThreshold,
          actual: normalizedActual,
        },
      };
    }

    if (condition === 'connection_request_sent_days_gt') {
      const thresholdDays = Number(expected || '0');
      const normalizedThreshold = Number.isFinite(thresholdDays) ? thresholdDays : 0;
      const sentAtRaw = leadRecord.connection_request_sent_at;

      if (typeof sentAtRaw !== 'string' || !sentAtRaw.trim()) {
        return {
          success: true,
          action: 'no',
          data: { condition, expected_days: normalizedThreshold, actual_days: null, sent_at: null },
        };
      }

      const sentAtMs = new Date(sentAtRaw).getTime();
      if (!Number.isFinite(sentAtMs)) {
        return {
          success: true,
          action: 'no',
          data: { condition, expected_days: normalizedThreshold, actual_days: null, sent_at: sentAtRaw },
        };
      }

      const ageDays = (Date.now() - sentAtMs) / (1000 * 60 * 60 * 24);
      const met = ageDays > normalizedThreshold;
      return {
        success: true,
        action: met ? 'yes' : 'no',
        data: {
          condition,
          expected_days: normalizedThreshold,
          actual_days: Number(ageDays.toFixed(2)),
          sent_at: sentAtRaw,
        },
      };
    }

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
    status: 'running' | 'success' | 'error' | 'skipped' | 'info',
    message: string,
    resultData: Record<string, unknown> = {},
    isTest = false
  ) {
    if (!this.currentRunId) {
      logger.info('Execution log (ephemeral)', {
        nodeId,
        nodeType,
        status,
        message,
        leadId,
      });
      return;
    }

    const runLogger = new LiveRunLogger(this.currentRunId);
    await runLogger.log(nodeId, nodeType, status, message, leadId || undefined, resultData, isTest);
  }

  async testNode({
    runId,
    action,
    nodeType = '',
    nodeData = {},
    linkedinUrl,
    linkedinProfileId,
    profileId,
    testUrl,
    lead,
    leadId,
    messageTemplate,
    nodes,
    edges,
    startNodeId,
    isTest = true,
  }: {
    runId?: string;
    action?: string;
    nodeType?: string;
    nodeData?: Record<string, unknown>;
    nodeId?: string;
    linkedinUrl?: string;
    linkedinProfileId?: string;
    profileId?: string;
    testUrl?: string;
    lead?: Lead;
    leadId?: string;
    messageTemplate?: string;
    nodes?: WorkflowNode[];
    edges?: WorkflowEdge[];
    startNodeId?: string;
    isTest?: boolean;
  }) {
    const actionToNodeType: Record<string, string> = {
      visit: 'visit_profile',
      connect: 'send_connection',
      message: 'send_message',
      follow: 'follow_profile',
      check: 'check_connection',
    };

    const resolvedNodeType = nodeType || (action ? actionToNodeType[action] : '');
    const resolvedProfileId = linkedinProfileId || profileId;
    const resolvedUrl = lead?.linkedin_url || linkedinUrl || testUrl || '';
    const resolvedNodeData: Record<string, unknown> = { ...nodeData };
    const resolvedNodes = Array.isArray(nodes)
      ? (nodes as WorkflowNode[]).filter((entry) => Boolean(entry?.id) && Boolean(entry?.type))
      : [];
    const resolvedEdges = Array.isArray(edges)
      ? (edges as WorkflowEdge[]).filter((entry) => Boolean(entry?.source) && Boolean(entry?.target))
      : [];
    const isPathTest = Boolean(startNodeId && resolvedNodes.length && resolvedEdges.length);

    if (
      resolvedNodeType === 'send_message' &&
      typeof messageTemplate === 'string' &&
      messageTemplate.trim() &&
      !resolvedNodeData.messageTemplate &&
      !resolvedNodeData.message
    ) {
      resolvedNodeData.messageTemplate = messageTemplate.trim();
    }
    const testRunId = runId || null;
    this.currentRunId = testRunId;

    const profileContext =
      resolvedProfileId && typeof resolvedProfileId === 'string'
        ? await this.getAutomationProfileContext(resolvedProfileId)
        : null;
    const usePersistentSession = Boolean(profileContext?.adspowerProfileId);
    let usedLocalBrowserForTest = !usePersistentSession;
    const testTwoFactorTimeoutMs = (() => {
      const parsed = Number(process.env.TEST_LOGIN_2FA_TIMEOUT_MS || 90000);
      if (!Number.isFinite(parsed) || parsed <= 0) return 90000;
      return Math.floor(parsed);
    })();

    try {
      await this.log(
        null,
        'test_init',
        'test',
        'running',
        isPathTest
          ? `Starting downstream path test from node ${startNodeId}...`
          : `Starting test for ${resolvedNodeType}...`,
        {},
        isTest
      );

      if (resolvedNodeType === 'wait_delay') {
        const res = await waitDelay(nodeData);
        await this.log(
          null,
          'test_wait',
          'wait_delay',
          res.success ? 'success' : 'error',
          (res as any).action || (res as any).error || 'Wait completed',
          {},
          isTest
        );
        return res;
      }

      if (!resolvedUrl) {
        throw new Error('linkedinUrl/testUrl is required for this test');
      }

      let page: Page;
      if (usePersistentSession) {
        try {
          page = await browserSessionManager.getSession(profileContext!.id, profileContext!.adspowerProfileId!);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await this.log(
            null,
            'test_ads_fallback',
            'system',
            'info',
            `AdsPower start failed (${message}). Falling back to local Chromium for test mode.`,
            {},
            isTest
          );
          page = await this.launchPageWithTimeout(90000, {});
          usedLocalBrowserForTest = true;
        }
      } else {
        page = await this.launchPageWithTimeout(90000, {});
      }

      if (profileContext) {
        const healed = await this.sessionHealer.healSession(
          profileContext.id,
          profileContext.adspowerProfileId || '',
          page,
          { twoFactorTimeoutMs: testTwoFactorTimeoutMs }
        );
        if (!healed) {
          if (usedLocalBrowserForTest) {
            const hasCredentials = await this.hasStoredCredentials(profileContext.id);
            if (!hasCredentials) {
              throw new Error(
                'AdsPower start failed and this profile has no stored LinkedIn credentials. ' +
                  'Add email/password in Settings > Profiles to enable fallback login.'
              );
            }
          }
          throw new Error('LinkedIn login failed before test run (session healer failed)');
        }

        if (!usedLocalBrowserForTest) {
          await syncInbox(page, profileContext.id).catch(() => undefined);
        }
      }

      const nowIso = new Date().toISOString();
      const fakeLead: Lead = lead
        ? {
            ...lead,
            id: lead.id || leadId || 'test',
            profile_id: lead.profile_id || resolvedProfileId || 'test',
            linkedin_url: lead.linkedin_url || resolvedUrl,
            first_name: lead.first_name ?? '',
            last_name: lead.last_name ?? '',
            company: lead.company ?? '',
            title: lead.title ?? '',
            extra_data: lead.extra_data ?? {},
            status: lead.status ?? 'pending',
            created_at: lead.created_at || nowIso,
            updated_at: lead.updated_at || nowIso,
          }
        : {
            id: leadId || 'test',
            profile_id: resolvedProfileId || 'test',
            linkedin_url: resolvedUrl,
            first_name: 'Test',
            last_name: 'User',
            company: 'Example',
            title: 'Operator',
            extra_data: {},
            status: 'pending',
            created_at: nowIso,
            updated_at: nowIso,
          };

      if (!fakeLead.linkedin_url) {
        throw new Error('linkedinUrl/testUrl is required for this test');
      }

      const nodeTypesNeedingProfileContext = new Set([
        'follow_profile',
        'send_message',
        'send_connection',
        'check_connection',
      ]);
      const startNodeTypeForContext = isPathTest
        ? resolvedNodes.find((node) => node.id === startNodeId)?.type || resolvedNodeType
        : resolvedNodeType;

      if (nodeTypesNeedingProfileContext.has(startNodeTypeForContext)) {
        await this.log(
          fakeLead.id,
          'test_visit',
          'visit_profile',
          'running',
          'Visiting profile for context...',
          {},
          isTest
        );
        await visitProfile(page, { useCurrentLead: true }, fakeLead);
        await page.waitForTimeout(1500);
      }

      if (isPathTest && startNodeId) {
        const pathResult = await this.executeNodePathForTest(
          page,
          resolvedNodes,
          resolvedEdges,
          startNodeId,
          fakeLead,
          isTest
        );

        await this.log(
          fakeLead.id,
          'test_result',
          'workflow_path',
          pathResult.success ? 'success' : 'error',
          pathResult.success
            ? `Path test completed (${pathResult.nodeResults.length} nodes)`
            : `Path test completed with node errors (${pathResult.nodeResults.length} nodes)`,
          {
            startNodeId,
            nodeResults: pathResult.nodeResults,
          },
          isTest
        );

        return {
          success: pathResult.success,
          action: 'workflow_path_test',
          data: {
            startNodeId,
            nodeResults: pathResult.nodeResults,
          },
        };
      }

      await this.log(
        fakeLead.id,
        'test_action',
        resolvedNodeType,
        'running',
        `Executing ${resolvedNodeType} action...`,
        {},
        isTest
      );

      let result: ActionResult;
      switch (resolvedNodeType) {
        case 'visit_profile':
          result = await visitProfile(page, { useCurrentLead: true }, fakeLead);
          break;
        case 'follow_profile':
          {
            const liveLogger = new LiveEventLogger(this.getSupabase() as any, testRunId || null, fakeLead.id);
            try {
              await this.prepareProfileForVision(page, fakeLead, liveLogger);
              result = await visionFollowProfile(page, fakeLead, this.getSupabase() as any, liveLogger);
              if (!result.success) {
                throw new Error(result.error || 'Vision follow failed');
              }
            } catch (error) {
              await liveLogger.emit(
                'action_failed',
                `Vision follow failed — using fallback: ${error instanceof Error ? error.message : String(error)}`
              );
              result = await followProfile(page, resolvedNodeData, fakeLead);
            }
          }
          break;
        case 'send_message':
          result = await sendMessage(page, resolvedNodeData, fakeLead);
          break;
        case 'send_connection':
          {
            const liveLogger = new LiveEventLogger(this.getSupabase() as any, testRunId || null, fakeLead.id);
            try {
              await this.prepareProfileForVision(page, fakeLead, liveLogger);
              result = await visionSendConnection(page, fakeLead, this.getSupabase() as any, liveLogger);
              if (!result.success) {
                throw new Error(result.error || 'Vision connect failed');
              }
            } catch (error) {
              await liveLogger.emit(
                'action_failed',
                `Vision connect failed — using fallback: ${error instanceof Error ? error.message : String(error)}`
              );
              result = await executeConnectAction(
                page,
                fakeLead,
                this.getSupabase() as any,
                undefined,
                testRunId || undefined
              );
            }
          }
          break;
        case 'check_connection':
          {
            const liveLogger = new LiveEventLogger(this.getSupabase() as any, testRunId || null, fakeLead.id);
            try {
              result = await visionCheckConnectionAccepted(page, fakeLead, this.getSupabase() as any, liveLogger);
              if (!result.success) {
                throw new Error(result.error || 'Vision connection check failed');
              }
            } catch (error) {
              await liveLogger.emit(
                'action_failed',
                `Vision check failed — using fallback: ${error instanceof Error ? error.message : String(error)}`
              );
              try {
                await this.prepareProfileForVision(page, fakeLead, liveLogger);
              } catch {
                // best effort before fallback checker
              }
              result = await checkConnection(page, fakeLead);
            }
          }
          break;
        default:
          result = { success: true, action: 'no_action' };
      }

      await this.log(
        fakeLead.id,
        'test_result',
        resolvedNodeType,
        result.success ? 'success' : 'error',
        result.action || result.error || 'Test finished',
        result.data,
        isTest
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Test failed';
      await this.log(null, 'test_error', 'error', 'error', errorMessage, {}, isTest);
      return { success: false, error: errorMessage };
    } finally {
      if (usedLocalBrowserForTest) {
        await this.manager.cleanup().catch((cleanupError) => {
          logger.warn('Failed to cleanup browser after node test', {
            error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          });
        });
      }

      if (testRunId) {
        setTimeout(() => {
          if (this.currentRunId === testRunId) {
            this.currentRunId = null;
          }
        }, 5000);
      } else {
        this.currentRunId = null;
      }
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

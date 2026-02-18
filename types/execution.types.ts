export type RunStatus = 'running' | 'completed' | 'stopped' | 'failed';
export type LogStatus = 'running' | 'success' | 'error' | 'skipped' | 'info';

export interface ExecutionRun {
  id: string;
  profile_id: string;
  workflow_id: string | null;
  campaign_id?: string | null;
  status: RunStatus;
  leads_total: number;
  leads_completed: number;
  leads_failed: number;
  started_at: string;
  completed_at: string | null;
}

export interface ExecutionLog {
  id: string;
  run_id: string;
  lead_id: string | null;
  node_id: string;
  node_type: string;
  status: LogStatus;
  message: string | null;
  result_data: Record<string, unknown>;
  is_test?: boolean;
  created_at: string;
}

export interface ActionResult {
  success: boolean;
  action?: string;
  error?: string;
  data?: Record<string, unknown>;
}

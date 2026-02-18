import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExecutionRun, ExecutionLog } from '@/types';

export async function createExecutionRun(
  supabase: SupabaseClient,
  profileId: string,
  workflowId: string,
  leadsTotal: number
): Promise<ExecutionRun> {
  const { data, error } = await supabase
    .from('execution_runs')
    .insert({ profile_id: profileId, workflow_id: workflowId, leads_total: leadsTotal, status: 'running' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateExecutionRun(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<ExecutionRun>
): Promise<void> {
  await supabase.from('execution_runs').update(updates).eq('id', id);
}

export async function getRunsByProfile(supabase: SupabaseClient, profileId: string, limit = 20): Promise<ExecutionRun[]> {
  const { data, error } = await supabase
    .from('execution_runs')
    .select('*')
    .eq('profile_id', profileId)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getLogsByRun(supabase: SupabaseClient, runId: string): Promise<ExecutionLog[]> {
  const { data, error } = await supabase
    .from('execution_logs')
    .select('*')
    .eq('run_id', runId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function insertLog(
  supabase: SupabaseClient,
  log: Omit<ExecutionLog, 'id' | 'created_at'>
): Promise<void> {
  await supabase.from('execution_logs').insert(log);
}

export async function createTestExecutionRun(
  supabase: SupabaseClient,
  profileId: string
): Promise<ExecutionRun> {
  const { data, error } = await supabase
    .from('execution_runs')
    .insert({
      profile_id: profileId,
      status: 'running',
      leads_total: 1,
      leads_completed: 0,
      leads_failed: 0,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create test execution run');
  }

  return data as ExecutionRun;
}

export async function completeExecutionRun(
  supabase: SupabaseClient,
  runId: string,
  status: 'completed' | 'failed' | 'stopped',
  leadsCompleted = 0,
  leadsFailed = 0
): Promise<void> {
  const { error } = await supabase
    .from('execution_runs')
    .update({
      status,
      leads_completed: leadsCompleted,
      leads_failed: leadsFailed,
      completed_at: new Date().toISOString(),
    })
    .eq('id', runId);

  if (error) {
    throw new Error(error.message);
  }
}

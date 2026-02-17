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

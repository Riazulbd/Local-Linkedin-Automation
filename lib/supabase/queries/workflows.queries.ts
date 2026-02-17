import type { SupabaseClient } from '@supabase/supabase-js';
import type { Workflow, CreateWorkflowInput, WorkflowNode, WorkflowEdge } from '@/types';

export async function getWorkflowsByProfile(supabase: SupabaseClient, profileId: string): Promise<Workflow[]> {
  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('profile_id', profileId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getWorkflowById(supabase: SupabaseClient, id: string): Promise<Workflow | null> {
  const { data, error } = await supabase.from('workflows').select('*').eq('id', id).single();
  if (error) return null;
  return data;
}

export async function createWorkflow(supabase: SupabaseClient, input: CreateWorkflowInput): Promise<Workflow> {
  const { data, error } = await supabase.from('workflows').insert(input).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateWorkflowName(supabase: SupabaseClient, id: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('workflows')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function updateWorkflowCanvas(
  supabase: SupabaseClient,
  id: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): Promise<void> {
  const { error } = await supabase
    .from('workflows')
    .update({ nodes, edges, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteWorkflow(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('workflows').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

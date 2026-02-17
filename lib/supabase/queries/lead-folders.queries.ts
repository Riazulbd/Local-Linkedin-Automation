import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreateFolderInput, LeadFolder } from '@/types';

export async function getLeadFolders(supabase: SupabaseClient): Promise<LeadFolder[]> {
  const { data, error } = await supabase
    .from('lead_folders')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LeadFolder[];
}

export async function getLeadFolderById(supabase: SupabaseClient, id: string): Promise<LeadFolder | null> {
  const { data, error } = await supabase.from('lead_folders').select('*').eq('id', id).single();
  if (error) return null;
  return data as LeadFolder;
}

export async function createLeadFolder(
  supabase: SupabaseClient,
  input: CreateFolderInput
): Promise<LeadFolder> {
  const { data, error } = await supabase
    .from('lead_folders')
    .insert({
      name: input.name,
      description: input.description ?? null,
      color: input.color ?? '#0ea5e9',
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as LeadFolder;
}

export async function updateLeadFolder(
  supabase: SupabaseClient,
  id: string,
  input: Partial<CreateFolderInput>
): Promise<LeadFolder> {
  const { data, error } = await supabase
    .from('lead_folders')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as LeadFolder;
}

export async function deleteLeadFolder(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('lead_folders').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function assignLeadsToFolder(
  supabase: SupabaseClient,
  folderId: string,
  leadIds: string[]
): Promise<number> {
  if (leadIds.length === 0) return 0;

  const { data, error } = await supabase
    .from('leads')
    .update({
      folder_id: folderId,
      updated_at: new Date().toISOString(),
    })
    .in('id', leadIds)
    .select('id');
  if (error) throw new Error(error.message);

  const assignedCount = (data ?? []).length;
  await refreshFolderLeadCount(supabase, folderId);
  return assignedCount;
}

export async function clearLeadsFromFolder(
  supabase: SupabaseClient,
  folderId: string,
  leadIds: string[]
): Promise<number> {
  if (leadIds.length === 0) return 0;

  const { data, error } = await supabase
    .from('leads')
    .update({
      folder_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('folder_id', folderId)
    .in('id', leadIds)
    .select('id');
  if (error) throw new Error(error.message);

  const clearedCount = (data ?? []).length;
  await refreshFolderLeadCount(supabase, folderId);
  return clearedCount;
}

export async function refreshFolderLeadCount(supabase: SupabaseClient, folderId: string): Promise<void> {
  const { count, error: countError } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('folder_id', folderId);
  if (countError) throw new Error(countError.message);

  const { error } = await supabase
    .from('lead_folders')
    .update({ lead_count: count ?? 0, updated_at: new Date().toISOString() })
    .eq('id', folderId);
  if (error) throw new Error(error.message);
}

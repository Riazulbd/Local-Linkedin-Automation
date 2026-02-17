import type { SupabaseClient } from '@supabase/supabase-js';
import type { Lead, LeadFolder } from '@/types';

interface FolderInput {
  name: string;
  description?: string | null;
  color?: string;
}

interface FolderPatch {
  name?: string;
  description?: string | null;
  color?: string;
  lead_count?: number;
}

export async function getAllFolders(supabase: SupabaseClient): Promise<LeadFolder[]> {
  const { data, error } = await supabase
    .from('lead_folders')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as LeadFolder[];
}

export async function createFolder(
  supabase: SupabaseClient,
  input: FolderInput
): Promise<LeadFolder> {
  const { data, error } = await supabase
    .from('lead_folders')
    .insert({
      name: input.name,
      description: input.description ?? null,
      color: input.color ?? '#0077b5',
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as LeadFolder;
}

export async function updateFolder(
  supabase: SupabaseClient,
  id: string,
  input: FolderPatch
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

  if (error) {
    throw new Error(error.message);
  }

  return data as LeadFolder;
}

export async function deleteFolder(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase
    .from('lead_folders')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getLeadsByFolder(
  supabase: SupabaseClient,
  folderId: string
): Promise<Lead[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('folder_id', folderId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Lead[];
}

export async function refreshFolderLeadCount(
  supabase: SupabaseClient,
  folderId: string
): Promise<void> {
  const { count, error } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('folder_id', folderId);

  if (error) {
    throw new Error(error.message);
  }

  await updateFolder(supabase, folderId, {
    lead_count: count ?? 0,
  });
}

export async function assignLeadsToFolder(
  supabase: SupabaseClient,
  folderId: string,
  leadIds: string[]
): Promise<number> {
  if (!leadIds.length) return 0;

  const { data, error } = await supabase
    .from('leads')
    .update({ folder_id: folderId, updated_at: new Date().toISOString() })
    .in('id', leadIds)
    .select('id');

  if (error) {
    throw new Error(error.message);
  }

  await refreshFolderLeadCount(supabase, folderId);
  return (data ?? []).length;
}

export async function clearLeadsFromFolder(
  supabase: SupabaseClient,
  folderId: string,
  leadIds: string[]
): Promise<number> {
  if (!leadIds.length) return 0;

  const { data, error } = await supabase
    .from('leads')
    .update({ folder_id: null, updated_at: new Date().toISOString() })
    .eq('folder_id', folderId)
    .in('id', leadIds)
    .select('id');

  if (error) {
    throw new Error(error.message);
  }

  await refreshFolderLeadCount(supabase, folderId);
  return (data ?? []).length;
}

export async function getFolderById(
  supabase: SupabaseClient,
  id: string
): Promise<LeadFolder | null> {
  const { data, error } = await supabase
    .from('lead_folders')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as LeadFolder | null) ?? null;
}

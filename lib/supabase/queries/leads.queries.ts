import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreateLeadInput, Lead, LeadStatus, UpdateLeadInput } from '@/types';

interface LeadQueryFilters {
  profileId?: string;
  folderId?: string;
  status?: LeadStatus;
  limit?: number;
}

export async function getLeads(
  supabase: SupabaseClient,
  filters: LeadQueryFilters = {}
): Promise<Lead[]> {
  let query = supabase.from('leads').select('*');
  if (filters.profileId) query = query.eq('profile_id', filters.profileId);
  if (filters.folderId) query = query.eq('folder_id', filters.folderId);
  if (filters.status) query = query.eq('status', filters.status);
  if (typeof filters.limit === 'number' && Number.isFinite(filters.limit)) query = query.limit(filters.limit);

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Lead[];
}

export async function getLeadById(
  supabase: SupabaseClient,
  leadId: string
): Promise<Lead | null> {
  const { data, error } = await supabase.from('leads').select('*').eq('id', leadId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Lead | null) ?? null;
}

export async function createLead(
  supabase: SupabaseClient,
  input: CreateLeadInput
): Promise<Lead> {
  const { data, error } = await supabase.from('leads').insert(input).select('*').single();
  if (error) throw new Error(error.message);
  return data as Lead;
}

export async function updateLead(
  supabase: SupabaseClient,
  id: string,
  input: UpdateLeadInput
): Promise<Lead> {
  const { data, error } = await supabase
    .from('leads')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as Lead;
}

export async function deleteLeadById(supabase: SupabaseClient, id: string): Promise<Lead | null> {
  const { data, error } = await supabase.from('leads').delete().eq('id', id).select('*').maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Lead | null) ?? null;
}

export async function getLeadsByProfile(
  supabase: SupabaseClient,
  profileId: string,
  status?: LeadStatus
): Promise<Lead[]> {
  let query = supabase.from('leads').select('*').eq('profile_id', profileId);
  if (status) query = query.eq('status', status);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function bulkInsertLeads(supabase: SupabaseClient, leads: CreateLeadInput[]): Promise<Lead[]> {
  const { data, error } = await supabase.from('leads').insert(leads).select();
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateLeadStatus(supabase: SupabaseClient, id: string, status: LeadStatus): Promise<void> {
  await supabase.from('leads').update({ status }).eq('id', id);
}

export async function resetProfileLeads(supabase: SupabaseClient, profileId: string): Promise<void> {
  await supabase.from('leads').update({ status: 'pending' }).eq('profile_id', profileId).eq('status', 'failed');
}

export async function deleteLeadsByProfile(supabase: SupabaseClient, profileId: string): Promise<void> {
  await supabase.from('leads').delete().eq('profile_id', profileId);
}

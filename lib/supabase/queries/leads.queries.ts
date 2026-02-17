import type { SupabaseClient } from '@supabase/supabase-js';
import type { Lead, CreateLeadInput, LeadStatus } from '@/types';

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

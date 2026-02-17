import type { SupabaseClient } from '@supabase/supabase-js';
import type { LinkedInProfile, CreateProfileInput, UpdateProfileInput } from '@/types';

export async function getAllProfiles(supabase: SupabaseClient): Promise<LinkedInProfile[]> {
  const { data, error } = await supabase
    .from('linkedin_profiles')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getProfileById(supabase: SupabaseClient, id: string): Promise<LinkedInProfile | null> {
  const { data, error } = await supabase
    .from('linkedin_profiles')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data;
}

export async function createProfile(supabase: SupabaseClient, input: CreateProfileInput): Promise<LinkedInProfile> {
  const { data, error } = await supabase
    .from('linkedin_profiles')
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateProfile(supabase: SupabaseClient, id: string, input: UpdateProfileInput): Promise<LinkedInProfile> {
  const { data, error } = await supabase
    .from('linkedin_profiles')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteProfile(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('linkedin_profiles').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function updateProfileStatus(
  supabase: SupabaseClient,
  id: string,
  status: LinkedInProfile['status']
): Promise<void> {
  await supabase.from('linkedin_profiles').update({ status }).eq('id', id);
}

export async function resetDailyCounts(supabase: SupabaseClient, id: string): Promise<void> {
  await supabase.rpc('reset_daily_counts', { p_profile_id: id });
}

export async function incrementCount(
  supabase: SupabaseClient,
  id: string,
  field: 'daily_visit_count' | 'daily_connect_count' | 'daily_message_count' | 'daily_follow_count'
): Promise<void> {
  await supabase.rpc('increment_profile_count', { p_profile_id: id, p_field: field });
}

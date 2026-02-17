import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Campaign,
  CampaignLeadProgress,
  CampaignStatus,
  CampaignStep,
  CreateCampaignInput,
} from '@/types';

interface CampaignWriteInput {
  name?: string;
  description?: string | null;
  status?: CampaignStatus;
  sequence?: CampaignStep[];
  daily_new_leads?: number;
}

export async function getCampaigns(supabase: SupabaseClient): Promise<Campaign[]> {
  const { data, error } = await supabase.from('campaigns').select('*').order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Campaign[];
}

export async function getCampaignById(supabase: SupabaseClient, id: string): Promise<Campaign | null> {
  const { data, error } = await supabase.from('campaigns').select('*').eq('id', id).single();
  if (error) return null;
  return data as Campaign;
}

export async function createCampaign(
  supabase: SupabaseClient,
  input: CreateCampaignInput
): Promise<Campaign> {
  const { profile_ids, folder_ids, ...campaignData } = input;

  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      name: campaignData.name,
      description: campaignData.description ?? null,
      sequence: campaignData.sequence ?? [],
      daily_new_leads: campaignData.daily_new_leads ?? 20,
      status: 'draft',
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  const campaign = data as Campaign;

  if (profile_ids.length > 0) {
    const rows = profile_ids.map((profileId) => ({
      campaign_id: campaign.id,
      profile_id: profileId,
      status: 'active',
    }));
    const { error: linkError } = await supabase.from('campaign_profiles').insert(rows);
    if (linkError) throw new Error(linkError.message);
  }

  if (folder_ids.length > 0) {
    const rows = folder_ids.map((folderId) => ({
      campaign_id: campaign.id,
      folder_id: folderId,
    }));
    const { error: folderError } = await supabase.from('campaign_lead_folders').insert(rows);
    if (folderError) throw new Error(folderError.message);
  }

  return campaign;
}

export async function updateCampaign(
  supabase: SupabaseClient,
  id: string,
  input: CampaignWriteInput
): Promise<Campaign> {
  const { data, error } = await supabase
    .from('campaigns')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as Campaign;
}

export async function deleteCampaign(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('campaigns').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function setCampaignStatus(
  supabase: SupabaseClient,
  id: string,
  status: CampaignStatus
): Promise<void> {
  const { error } = await supabase
    .from('campaigns')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function setCampaignProfiles(
  supabase: SupabaseClient,
  campaignId: string,
  profileIds: string[]
): Promise<void> {
  const { error: deleteError } = await supabase.from('campaign_profiles').delete().eq('campaign_id', campaignId);
  if (deleteError) throw new Error(deleteError.message);

  if (!profileIds.length) return;

  const rows = profileIds.map((profileId) => ({
    campaign_id: campaignId,
    profile_id: profileId,
    status: 'active',
  }));
  const { error } = await supabase.from('campaign_profiles').insert(rows);
  if (error) throw new Error(error.message);
}

export async function setCampaignFolders(
  supabase: SupabaseClient,
  campaignId: string,
  folderIds: string[]
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('campaign_lead_folders')
    .delete()
    .eq('campaign_id', campaignId);
  if (deleteError) throw new Error(deleteError.message);

  if (!folderIds.length) return;

  const rows = folderIds.map((folderId) => ({
    campaign_id: campaignId,
    folder_id: folderId,
  }));
  const { error } = await supabase.from('campaign_lead_folders').insert(rows);
  if (error) throw new Error(error.message);
}

export async function getCampaignProgress(
  supabase: SupabaseClient,
  campaignId: string
): Promise<CampaignLeadProgress[]> {
  const { data, error } = await supabase
    .from('campaign_lead_progress')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('updated_at', { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as CampaignLeadProgress[];
}

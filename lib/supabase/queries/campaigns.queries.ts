import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Campaign,
  CampaignLeadProgress,
  CampaignStatus,
  CampaignStep,
  CreateCampaignInput,
} from '@/types';
import { buildDefaultCampaignSequence, normalizeCampaignSequence } from '@/lib/logic/campaign.logic';

interface CampaignPatchInput {
  name?: string;
  description?: string | null;
  status?: CampaignStatus;
  folder_id?: string | null;
  daily_new_leads?: number;
  respect_working_hrs?: boolean;
}

function normalizeStepRows(
  campaignId: string,
  steps: Array<CampaignStep | (Omit<CampaignStep, 'id' | 'campaign_id'> & { id?: string })>
) {
  const normalized = normalizeCampaignSequence(steps as unknown as CampaignStep[]);
  return normalized.map((step, index) => ({
    id: step.id,
    campaign_id: campaignId,
    step_order: index,
    step_type: step.step_type,
    config: step.config ?? {},
  }));
}

function toCampaignRow(data: Record<string, unknown>): Campaign {
  return {
    id: String(data.id),
    name: String(data.name || ''),
    description: data.description == null ? null : String(data.description),
    status: (data.status as CampaignStatus) || 'draft',
    folder_id: data.folder_id == null ? null : String(data.folder_id),
    daily_new_leads: Number(data.daily_new_leads ?? 10),
    respect_working_hrs: data.respect_working_hrs == null ? true : Boolean(data.respect_working_hrs),
    total_leads: Number(data.total_leads ?? 0),
    contacted_leads: Number(data.contacted_leads ?? 0),
    replied_leads: Number(data.replied_leads ?? 0),
    created_at: String(data.created_at || new Date().toISOString()),
    updated_at: String(data.updated_at || new Date().toISOString()),
  };
}

export async function getAllCampaigns(supabase: SupabaseClient): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => toCampaignRow(row as Record<string, unknown>));
}

export async function getCampaignById(
  supabase: SupabaseClient,
  id: string
): Promise<Campaign | null> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const [steps, profileRows] = await Promise.all([
    getCampaignSteps(supabase, id),
    supabase
      .from('campaign_profiles')
      .select('profile_id')
      .eq('campaign_id', id)
      .eq('is_active', true),
  ]);

  if (profileRows.error) throw new Error(profileRows.error.message);

  const campaign = toCampaignRow(data as Record<string, unknown>);
  campaign.steps = steps;
  campaign.profiles = (profileRows.data ?? []).map((row) =>
    String((row as Record<string, unknown>).profile_id)
  );
  campaign.profile_ids = campaign.profiles;
  return campaign;
}

export async function createCampaign(
  supabase: SupabaseClient,
  input: CreateCampaignInput
): Promise<Campaign> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      name: input.name,
      description: input.description ?? null,
      status: input.status ?? 'draft',
      folder_id: input.folder_id ?? null,
      daily_new_leads: input.daily_new_leads ?? 10,
      respect_working_hrs: input.respect_working_hrs ?? true,
      updated_at: now,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  const campaign = toCampaignRow(data as Record<string, unknown>);

  const profileIds = Array.isArray(input.profile_ids)
    ? input.profile_ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];

  if (profileIds.length) {
    const rows = profileIds.map((profileId) => ({
      campaign_id: campaign.id,
      profile_id: profileId,
      is_active: true,
    }));
    const { error: profileError } = await supabase
      .from('campaign_profiles')
      .upsert(rows, { onConflict: 'campaign_id,profile_id' });
    if (profileError) throw new Error(profileError.message);
  }

  const sourceSteps = input.steps && input.steps.length ? input.steps : buildDefaultCampaignSequence();
  await upsertCampaignSteps(supabase, campaign.id, sourceSteps);

  return (await getCampaignById(supabase, campaign.id)) as Campaign;
}

export async function updateCampaignStatus(
  supabase: SupabaseClient,
  id: string,
  status: CampaignStatus
): Promise<void> {
  const { error } = await supabase
    .from('campaigns')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function addProfileToCampaign(
  supabase: SupabaseClient,
  campaignId: string,
  profileId: string
): Promise<void> {
  const { error } = await supabase
    .from('campaign_profiles')
    .upsert(
      {
        campaign_id: campaignId,
        profile_id: profileId,
        is_active: true,
      },
      { onConflict: 'campaign_id,profile_id' }
    );

  if (error) throw new Error(error.message);
}

export async function removeProfileFromCampaign(
  supabase: SupabaseClient,
  campaignId: string,
  profileId: string
): Promise<void> {
  const { error } = await supabase
    .from('campaign_profiles')
    .delete()
    .eq('campaign_id', campaignId)
    .eq('profile_id', profileId);

  if (error) throw new Error(error.message);
}

export async function getCampaignSteps(
  supabase: SupabaseClient,
  campaignId: string
): Promise<CampaignStep[]> {
  const { data, error } = await supabase
    .from('campaign_steps')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('step_order', { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    const stepType = String(record.step_type) as CampaignStep['step_type'];
    const stepOrder = Number(record.step_order ?? 0);
    return {
      id: String(record.id),
      campaign_id: String(record.campaign_id),
      step_order: stepOrder,
      step_type: stepType,
      type: stepType,
      order: stepOrder,
      config: (record.config as Record<string, unknown>) ?? {},
      created_at: record.created_at == null ? undefined : String(record.created_at),
    };
  });
}

export async function upsertCampaignSteps(
  supabase: SupabaseClient,
  campaignId: string,
  steps: Array<CampaignStep | (Omit<CampaignStep, 'id' | 'campaign_id'> & { id?: string })>
): Promise<void> {
  const rows = normalizeStepRows(campaignId, steps);

  const { error: deleteError } = await supabase
    .from('campaign_steps')
    .delete()
    .eq('campaign_id', campaignId);

  if (deleteError) throw new Error(deleteError.message);
  if (!rows.length) return;

  const { error } = await supabase
    .from('campaign_steps')
    .insert(rows);

  if (error) throw new Error(error.message);
}

export async function getLeadProgress(
  supabase: SupabaseClient,
  campaignId: string,
  profileId: string
): Promise<CampaignLeadProgress[]> {
  const { data, error } = await supabase
    .from('campaign_lead_progress')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('profile_id', profileId)
    .order('updated_at', { ascending: false })
    .limit(1000);

  if (error) throw new Error(error.message);
  return (data ?? []) as CampaignLeadProgress[];
}

export async function getDueLeads(
  supabase: SupabaseClient,
  campaignId: string,
  profileId: string
): Promise<CampaignLeadProgress[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('campaign_lead_progress')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('profile_id', profileId)
    .in('status', ['pending', 'waiting', 'active'])
    .or(`next_action_at.is.null,next_action_at.lte.${now}`)
    .order('next_action_at', { ascending: true, nullsFirst: true })
    .limit(200);

  if (error) throw new Error(error.message);
  return (data ?? []) as CampaignLeadProgress[];
}

// ---------------------------------------------------------------------
// Compatibility wrappers for current API/UI code paths
// ---------------------------------------------------------------------
export async function getCampaigns(supabase: SupabaseClient): Promise<Campaign[]> {
  return getAllCampaigns(supabase);
}

export async function updateCampaign(
  supabase: SupabaseClient,
  id: string,
  patch: CampaignPatchInput & { steps?: CampaignStep[] }
): Promise<Campaign> {
  const campaignPatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (patch.name !== undefined) campaignPatch.name = patch.name;
  if (patch.description !== undefined) campaignPatch.description = patch.description;
  if (patch.status !== undefined) campaignPatch.status = patch.status;
  if (patch.folder_id !== undefined) campaignPatch.folder_id = patch.folder_id;
  if (patch.daily_new_leads !== undefined) campaignPatch.daily_new_leads = patch.daily_new_leads;
  if (patch.respect_working_hrs !== undefined) campaignPatch.respect_working_hrs = patch.respect_working_hrs;

  const { data, error } = await supabase
    .from('campaigns')
    .update(campaignPatch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  if (patch.steps) {
    await upsertCampaignSteps(supabase, id, patch.steps);
  }

  const campaign = toCampaignRow(data as Record<string, unknown>);
  campaign.steps = await getCampaignSteps(supabase, id);
  return campaign;
}

export async function deleteCampaign(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from('campaigns').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function setCampaignStatus(
  supabase: SupabaseClient,
  id: string,
  status: CampaignStatus
): Promise<void> {
  await updateCampaignStatus(supabase, id, status);
}

export async function setCampaignProfiles(
  supabase: SupabaseClient,
  campaignId: string,
  profileIds: string[]
): Promise<void> {
  const normalized = profileIds.filter((id): id is string => typeof id === 'string' && id.length > 0);
  const { error: deleteError } = await supabase
    .from('campaign_profiles')
    .delete()
    .eq('campaign_id', campaignId);
  if (deleteError) throw new Error(deleteError.message);

  if (!normalized.length) return;

  const rows = normalized.map((profileId) => ({
    campaign_id: campaignId,
    profile_id: profileId,
    is_active: true,
  }));

  const { error } = await supabase.from('campaign_profiles').insert(rows);
  if (error) throw new Error(error.message);
}

export async function setCampaignFolders(
  supabase: SupabaseClient,
  campaignId: string,
  folderIds: string[]
): Promise<void> {
  const folderId = folderIds.find((id): id is string => typeof id === 'string' && id.length > 0) ?? null;
  const { error } = await supabase
    .from('campaigns')
    .update({ folder_id: folderId, updated_at: new Date().toISOString() })
    .eq('id', campaignId);

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
    .limit(1000);

  if (error) throw new Error(error.message);
  return (data ?? []) as CampaignLeadProgress[];
}

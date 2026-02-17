import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createCampaign, getAllCampaigns } from '@/lib/supabase/queries/campaigns.queries';
import {
  buildDefaultCampaignSequence,
  normalizeCampaignSequence,
  validateCampaignSequence,
} from '@/lib/logic/campaign.logic';
import type { CreateCampaignInput } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = createServiceClient();
    const campaigns = await getAllCampaigns(supabase);

    const [{ data: profileRows, error: profilesError }, { data: stepRows, error: stepsError }] = await Promise.all([
      supabase
        .from('campaign_profiles')
        .select('campaign_id, profile_id')
        .eq('is_active', true),
      supabase
        .from('campaign_steps')
        .select('*')
        .order('step_order', { ascending: true }),
    ]);

    if (profilesError) throw new Error(profilesError.message);
    if (stepsError) throw new Error(stepsError.message);

    const stepsByCampaign = new Map<string, any[]>();
    for (const row of stepRows ?? []) {
      const campaignId = String((row as Record<string, unknown>).campaign_id || '');
      if (!campaignId) continue;
      const list = stepsByCampaign.get(campaignId) || [];
      list.push(row);
      stepsByCampaign.set(campaignId, list);
    }

    const campaignProfiles = new Map<string, string[]>();
    for (const row of profileRows ?? []) {
      const campaignId = String((row as Record<string, unknown>).campaign_id || '');
      const profileId = String((row as Record<string, unknown>).profile_id || '');
      if (!campaignId || !profileId) continue;
      const list = campaignProfiles.get(campaignId) || [];
      list.push(profileId);
      campaignProfiles.set(campaignId, list);
    }

    const enriched = campaigns.map((campaign) => {
      const profiles = campaignProfiles.get(campaign.id) || [];
      const steps = (stepsByCampaign.get(campaign.id) || []).map((row) => {
        const record = row as Record<string, unknown>;
        const stepType = String(record.step_type) as any;
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

      return {
        ...campaign,
        profiles,
        profile_ids: profiles,
        steps,
        sequence: steps,
      };
    });

    return NextResponse.json(
      { campaigns: enriched },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load campaigns' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<CreateCampaignInput>;
    const supabase = createServiceClient();

    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const folderId = typeof body.folder_id === 'string'
      ? body.folder_id
      : Array.isArray(body.folder_ids)
        ? body.folder_ids.find((id): id is string => typeof id === 'string' && id.length > 0) ?? null
        : null;

    const rawSteps = body.steps ?? body.sequence ?? buildDefaultCampaignSequence();
    const steps = normalizeCampaignSequence(rawSteps);
    const stepsValidation = validateCampaignSequence(steps);
    if (!stepsValidation.valid) {
      return NextResponse.json({ error: stepsValidation.reason }, { status: 400 });
    }

    const input: CreateCampaignInput = {
      name: body.name.trim(),
      description: typeof body.description === 'string' ? body.description : undefined,
      status: typeof body.status === 'string' ? body.status : undefined,
      folder_id: folderId,
      daily_new_leads:
        typeof body.daily_new_leads === 'number' && Number.isFinite(body.daily_new_leads)
          ? body.daily_new_leads
          : undefined,
      respect_working_hrs:
        typeof body.respect_working_hrs === 'boolean' ? body.respect_working_hrs : undefined,
      profile_ids: Array.isArray(body.profile_ids)
        ? body.profile_ids.filter((id): id is string => typeof id === 'string')
        : [],
      steps,
    };

    const campaign = await createCampaign(supabase, input);
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create campaign' },
      { status: 500 }
    );
  }
}

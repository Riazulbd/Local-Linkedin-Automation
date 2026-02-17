import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createCampaign, getCampaigns } from '@/lib/supabase/queries/campaigns.queries';
import { buildDefaultCampaignSequence, normalizeCampaignSequence, validateCampaignSequence } from '@/lib/logic/campaign.logic';
import type { CreateCampaignInput } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = createServiceClient();

    const [campaigns, profileLinksRes, folderLinksRes] = await Promise.all([
      getCampaigns(supabase),
      supabase.from('campaign_profiles').select('campaign_id, profile_id, status'),
      supabase.from('campaign_lead_folders').select('campaign_id, folder_id'),
    ]);

    if (profileLinksRes.error) throw new Error(profileLinksRes.error.message);
    if (folderLinksRes.error) throw new Error(folderLinksRes.error.message);

    const profileLinks = profileLinksRes.data ?? [];
    const folderLinks = folderLinksRes.data ?? [];

    const enriched = campaigns.map((campaign) => ({
      ...campaign,
      profile_ids: profileLinks
        .filter((row) => String((row as Record<string, unknown>).campaign_id) === campaign.id)
        .map((row) => String((row as Record<string, unknown>).profile_id)),
      folder_ids: folderLinks
        .filter((row) => String((row as Record<string, unknown>).campaign_id) === campaign.id)
        .map((row) => String((row as Record<string, unknown>).folder_id)),
    }));

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

    const sequence = normalizeCampaignSequence(body.sequence ?? buildDefaultCampaignSequence());
    const sequenceValidation = validateCampaignSequence(sequence);
    if (!sequenceValidation.valid) {
      return NextResponse.json({ error: sequenceValidation.reason }, { status: 400 });
    }

    const input: CreateCampaignInput = {
      name: body.name,
      description: typeof body.description === 'string' ? body.description : undefined,
      sequence,
      daily_new_leads:
        typeof body.daily_new_leads === 'number' && Number.isFinite(body.daily_new_leads)
          ? body.daily_new_leads
          : undefined,
      profile_ids: Array.isArray(body.profile_ids)
        ? body.profile_ids.filter((id): id is string => typeof id === 'string')
        : [],
      folder_ids: Array.isArray(body.folder_ids)
        ? body.folder_ids.filter((id): id is string => typeof id === 'string')
        : [],
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

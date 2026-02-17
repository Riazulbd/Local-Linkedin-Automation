import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  deleteCampaign,
  getCampaignById,
  getCampaignProgress,
  setCampaignFolders,
  setCampaignProfiles,
  updateCampaign,
} from '@/lib/supabase/queries/campaigns.queries';
import { normalizeCampaignSequence, validateCampaignSequence } from '@/lib/logic/campaign.logic';
import type { CampaignStatus, CreateCampaignInput } from '@/types';

interface RouteContext {
  params: { id: string };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_: Request, { params }: RouteContext) {
  try {
    const supabase = createServiceClient();
    const campaign = await getCampaignById(supabase, params.id);
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const progress = await getCampaignProgress(supabase, params.id);
    return NextResponse.json({ campaign, progress });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load campaign' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<CreateCampaignInput> & {
      sequence?: unknown;
    };
    const supabase = createServiceClient();

    const patch: Parameters<typeof updateCampaign>[2] = {};
    if (typeof body.name === 'string') patch.name = body.name;
    if (typeof body.description === 'string' || body.description === null) patch.description = body.description;
    if (typeof body.daily_new_leads === 'number' && Number.isFinite(body.daily_new_leads)) {
      patch.daily_new_leads = body.daily_new_leads;
    }
    if (typeof body.respect_working_hrs === 'boolean') {
      patch.respect_working_hrs = body.respect_working_hrs;
    }
    if (typeof body.status === 'string') {
      patch.status = body.status as CampaignStatus;
    }
    if (body.folder_id !== undefined) {
      patch.folder_id = body.folder_id;
    }

    const rawSteps = body.steps ?? body.sequence;
    if (rawSteps !== undefined) {
      const normalized = normalizeCampaignSequence(rawSteps);
      const validation = validateCampaignSequence(normalized);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.reason }, { status: 400 });
      }
      patch.steps = normalized;
    }

    await updateCampaign(supabase, params.id, patch);

    if (Array.isArray(body.profile_ids)) {
      const profileIds = body.profile_ids.filter((id): id is string => typeof id === 'string');
      await setCampaignProfiles(supabase, params.id, profileIds);
    }

    if (Array.isArray(body.folder_ids)) {
      const folderIds = body.folder_ids.filter((id): id is string => typeof id === 'string');
      await setCampaignFolders(supabase, params.id, folderIds);
    } else if (body.folder_id !== undefined) {
      await setCampaignFolders(supabase, params.id, body.folder_id ? [body.folder_id] : []);
    }

    const campaign = await getCampaignById(supabase, params.id);
    return NextResponse.json({ campaign });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update campaign' },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, { params }: RouteContext) {
  try {
    const supabase = createServiceClient();
    await deleteCampaign(supabase, params.id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete campaign' },
      { status: 500 }
    );
  }
}

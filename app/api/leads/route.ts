import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { logAppAction } from '@/lib/supabase/queries/action-logs.queries';
import { createLead, getLeads } from '@/lib/supabase/queries/leads.queries';
import { refreshFolderLeadCount } from '@/lib/supabase/queries/folders.queries';
import type { CreateLeadInput } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  noStore();
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get('profileId') || undefined;
    const folderId = searchParams.get('folder_id') || undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Number(limitParam) : undefined;

    const leads = await getLeads(supabase, {
      profileId,
      folderId,
      limit: Number.isFinite(limit as number) ? limit : undefined,
    });

    return NextResponse.json(
      { leads, data: leads },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load leads' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const supabase = createServiceClient();
  const rawBody = await req.json().catch(() => ({}));
  const body =
    rawBody && typeof rawBody === 'object'
      ? (rawBody as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  const requestSnapshot = {
    profile_id:
      typeof body.profile_id === 'string' && body.profile_id.trim()
        ? body.profile_id.trim()
        : typeof body.profileId === 'string' && body.profileId.trim()
          ? body.profileId.trim()
          : null,
    folder_id:
      typeof body.folder_id === 'string' && body.folder_id.trim()
        ? body.folder_id.trim()
        : typeof body.folderId === 'string' && body.folderId.trim()
          ? body.folderId.trim()
          : null,
    linkedin_url: typeof body.linkedin_url === 'string' ? body.linkedin_url.trim() : null,
    first_name: typeof body.first_name === 'string' ? body.first_name.trim() : null,
    last_name: typeof body.last_name === 'string' ? body.last_name.trim() : null,
    company: typeof body.company === 'string' ? body.company.trim() : null,
    title: typeof body.title === 'string' ? body.title.trim() : null,
  };

  try {
    const userId =
      typeof body.user_id === 'string' && body.user_id.trim()
        ? body.user_id.trim()
        : typeof body.userId === 'string' && body.userId.trim()
          ? body.userId.trim()
          : undefined;

    if (!requestSnapshot.linkedin_url) {
      await logAppAction(supabase, {
        actionType: 'lead.create',
        entityType: 'lead',
        status: 'error',
        requestData: requestSnapshot,
        errorMessage: 'linkedin_url is required',
      }).catch(() => undefined);
      return NextResponse.json({ error: 'linkedin_url is required' }, { status: 400 });
    }

    if (!requestSnapshot.profile_id) {
      await logAppAction(supabase, {
        actionType: 'lead.create',
        entityType: 'lead',
        status: 'error',
        requestData: requestSnapshot,
        errorMessage: 'profile_id is required',
      }).catch(() => undefined);
      return NextResponse.json({ error: 'profile_id is required' }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('linkedin_profiles')
      .select('id')
      .eq('id', requestSnapshot.profile_id)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile) {
      await logAppAction(supabase, {
        actionType: 'lead.create',
        entityType: 'lead',
        status: 'error',
        requestData: requestSnapshot,
        errorMessage: 'Selected profile does not exist',
      }).catch(() => undefined);
      return NextResponse.json(
        { error: 'Selected profile does not exist. Refresh profiles and try again.' },
        { status: 400 }
      );
    }

    if (requestSnapshot.folder_id) {
      const { data: folder, error: folderError } = await supabase
        .from('lead_folders')
        .select('id')
        .eq('id', requestSnapshot.folder_id)
        .maybeSingle();
      if (folderError) throw new Error(folderError.message);
      if (!folder) {
        await logAppAction(supabase, {
          actionType: 'lead.create',
          entityType: 'lead',
          status: 'error',
          requestData: requestSnapshot,
          errorMessage: 'Selected folder does not exist',
        }).catch(() => undefined);
        return NextResponse.json(
          { error: 'Selected folder does not exist. Refresh folders and try again.' },
          { status: 400 }
        );
      }
    }

    const input: CreateLeadInput = {
      user_id: userId,
      profile_id: requestSnapshot.profile_id,
      linkedin_url: requestSnapshot.linkedin_url,
      first_name: typeof body.first_name === 'string' && body.first_name.trim() ? body.first_name.trim() : undefined,
      last_name: typeof body.last_name === 'string' && body.last_name.trim() ? body.last_name.trim() : undefined,
      company: typeof body.company === 'string' && body.company.trim() ? body.company.trim() : undefined,
      title: typeof body.title === 'string' && body.title.trim() ? body.title.trim() : undefined,
      folder_id: requestSnapshot.folder_id ?? undefined,
      notes: typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : undefined,
      extra_data:
        body.extra_data && typeof body.extra_data === 'object'
          ? (body.extra_data as Record<string, string>)
          : {},
    };
    const lead = await createLead(supabase, input);
    if (lead.folder_id) {
      await refreshFolderLeadCount(supabase, lead.folder_id).catch(() => undefined);
    }
    await logAppAction(supabase, {
      actionType: 'lead.create',
      entityType: 'lead',
      entityId: lead.id,
      status: 'success',
      requestData: requestSnapshot,
      responseData: { lead_id: lead.id, profile_id: lead.profile_id, folder_id: lead.folder_id },
    }).catch(() => undefined);

    return NextResponse.json({ lead, data: lead }, { status: 201 });
  } catch (error) {
    await logAppAction(supabase, {
      actionType: 'lead.create',
      entityType: 'lead',
      status: 'error',
      requestData: requestSnapshot,
      errorMessage: error instanceof Error ? error.message : 'Failed to create lead',
    }).catch(() => undefined);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create lead' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
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
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const userId =
      typeof body.user_id === 'string' && body.user_id.trim()
        ? body.user_id.trim()
        : typeof body.userId === 'string' && body.userId.trim()
          ? body.userId.trim()
          : undefined;

    if (typeof body.linkedin_url !== 'string' || !body.linkedin_url.trim()) {
      return NextResponse.json({ error: 'linkedin_url is required' }, { status: 400 });
    }

    if (typeof body.profile_id !== 'string' || !body.profile_id.trim()) {
      return NextResponse.json({ error: 'profile_id is required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const input: CreateLeadInput = {
      user_id: userId,
      profile_id: body.profile_id.trim(),
      linkedin_url: body.linkedin_url.trim(),
      first_name: typeof body.first_name === 'string' && body.first_name.trim() ? body.first_name.trim() : undefined,
      last_name: typeof body.last_name === 'string' && body.last_name.trim() ? body.last_name.trim() : undefined,
      company: typeof body.company === 'string' && body.company.trim() ? body.company.trim() : undefined,
      title: typeof body.title === 'string' && body.title.trim() ? body.title.trim() : undefined,
      folder_id: typeof body.folder_id === 'string' && body.folder_id.trim() ? body.folder_id.trim() : undefined,
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

    return NextResponse.json({ lead, data: lead }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create lead' },
      { status: 500 }
    );
  }
}

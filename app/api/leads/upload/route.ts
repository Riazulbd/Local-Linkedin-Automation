import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { logAppAction } from '@/lib/supabase/queries/action-logs.queries';
import { bulkInsertLeads } from '@/lib/supabase/queries/leads.queries';
import { refreshFolderLeadCount } from '@/lib/supabase/queries/folders.queries';
import type { CreateLeadInput } from '@/types';

interface UploadLead {
  linkedin_url: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  title?: string;
  extra_data?: Record<string, string>;
}

function chunk<T>(items: T[], size: number): T[][] {
  const parts: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    parts.push(items.slice(i, i + size));
  }
  return parts;
}

export async function POST(req: Request) {
  const supabase = createServiceClient();
  const rawBody = await req.json().catch(() => ({}));
  const body =
    rawBody && typeof rawBody === 'object'
      ? (rawBody as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  const leads = Array.isArray(body.leads) ? (body.leads as UploadLead[]) : [];
  const profileId = typeof body.profileId === 'string' ? body.profileId : null;
  const folderId = typeof body.folderId === 'string' ? body.folderId : null;
  const requestSnapshot = {
    profile_id: profileId,
    folder_id: folderId,
    leads_count: leads.length,
  };

  try {
    const userId =
      typeof body.user_id === 'string' && body.user_id.trim()
        ? body.user_id.trim()
        : typeof body.userId === 'string' && body.userId.trim()
          ? body.userId.trim()
          : null;
    if (!leads.length) {
      await logAppAction(supabase, {
        actionType: 'lead.bulk_upload',
        entityType: 'lead',
        status: 'error',
        requestData: requestSnapshot,
        errorMessage: 'No leads provided',
      }).catch(() => undefined);
      return NextResponse.json({ error: 'No leads provided' }, { status: 400 });
    }

    if (!profileId) {
      await logAppAction(supabase, {
        actionType: 'lead.bulk_upload',
        entityType: 'lead',
        status: 'error',
        requestData: requestSnapshot,
        errorMessage: 'profileId is required',
      }).catch(() => undefined);
      return NextResponse.json({ error: 'profileId is required' }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('linkedin_profiles')
      .select('id')
      .eq('id', profileId)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile) {
      await logAppAction(supabase, {
        actionType: 'lead.bulk_upload',
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

    if (folderId) {
      const { data: folder, error: folderError } = await supabase
        .from('lead_folders')
        .select('id')
        .eq('id', folderId)
        .maybeSingle();
      if (folderError) throw new Error(folderError.message);
      if (!folder) {
        await logAppAction(supabase, {
          actionType: 'lead.bulk_upload',
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

    const inserts = leads
      .map((lead): CreateLeadInput | null => {
        const linkedinUrl = typeof lead.linkedin_url === 'string' ? lead.linkedin_url.trim() : '';
        if (!linkedinUrl) return null;

        return {
          user_id: userId ?? undefined,
          profile_id: profileId,
          linkedin_url: linkedinUrl,
          first_name: lead.first_name?.trim() || '',
          last_name: lead.last_name?.trim() || '',
          company: lead.company?.trim() || '',
          title: lead.title?.trim() || '',
          extra_data: lead.extra_data || {},
          folder_id: folderId,
        };
      })
      .filter((lead): lead is CreateLeadInput => lead !== null);

    if (!inserts.length) {
      await logAppAction(supabase, {
        actionType: 'lead.bulk_upload',
        entityType: 'lead',
        status: 'error',
        requestData: requestSnapshot,
        errorMessage: 'No valid leads found in payload',
      }).catch(() => undefined);
      return NextResponse.json({ error: 'No valid leads found in payload' }, { status: 400 });
    }

    let inserted = 0;
    for (const group of chunk(inserts, 500)) {
      const rows = await bulkInsertLeads(supabase, group);
      inserted += rows.length;
    }

    if (folderId) {
      await refreshFolderLeadCount(supabase, folderId);
    }
    await logAppAction(supabase, {
      actionType: 'lead.bulk_upload',
      entityType: 'lead',
      status: 'success',
      requestData: requestSnapshot,
      responseData: { inserted },
    }).catch(() => undefined);

    return NextResponse.json({ inserted });
  } catch (error) {
    await logAppAction(supabase, {
      actionType: 'lead.bulk_upload',
      entityType: 'lead',
      status: 'error',
      requestData: requestSnapshot,
      errorMessage: error instanceof Error ? error.message : 'Failed to upload leads',
    }).catch(() => undefined);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload leads' },
      { status: 500 }
    );
  }
}

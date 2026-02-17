import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
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
  try {
    const body = await req.json();
    const leads = Array.isArray(body.leads) ? (body.leads as UploadLead[]) : [];
    const profileId = typeof body.profileId === 'string' ? body.profileId : null;
    const folderId = typeof body.folderId === 'string' ? body.folderId : null;

    if (!leads.length) {
      return NextResponse.json({ error: 'No leads provided' }, { status: 400 });
    }

    if (!profileId) {
      return NextResponse.json({ error: 'profileId is required' }, { status: 400 });
    }

    const inserts = leads
      .map((lead): CreateLeadInput | null => {
        const linkedinUrl = typeof lead.linkedin_url === 'string' ? lead.linkedin_url.trim() : '';
        if (!linkedinUrl) return null;

        return {
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
      return NextResponse.json({ error: 'No valid leads found in payload' }, { status: 400 });
    }

    const supabase = createServiceClient();
    let inserted = 0;
    for (const group of chunk(inserts, 500)) {
      const rows = await bulkInsertLeads(supabase, group);
      inserted += rows.length;
    }

    if (folderId) {
      await refreshFolderLeadCount(supabase, folderId);
    }

    return NextResponse.json({ inserted });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload leads' },
      { status: 500 }
    );
  }
}

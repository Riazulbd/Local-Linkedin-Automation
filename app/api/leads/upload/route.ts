import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

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

    if (!leads.length) {
      return NextResponse.json({ error: 'No leads provided' }, { status: 400 });
    }

    if (!profileId) {
      return NextResponse.json({ error: 'profileId is required' }, { status: 400 });
    }

    const valid = leads
      .map((lead) => {
        const row: Record<string, unknown> = {
          linkedin_url: typeof lead.linkedin_url === 'string' ? lead.linkedin_url.trim() : '',
          first_name: lead.first_name?.trim() || '',
          last_name: lead.last_name?.trim() || '',
          company: lead.company?.trim() || '',
          title: lead.title?.trim() || '',
          extra_data: lead.extra_data || {},
          status: 'pending' as const,
          profile_id: profileId,
        };
        return row;
      })
      .filter((lead) => Boolean(lead.linkedin_url));

    if (!valid.length) {
      return NextResponse.json({ error: 'No valid leads found in payload' }, { status: 400 });
    }

    const supabase = createServiceClient();

    for (const group of chunk(valid, 500)) {
      const { error } = await supabase.from('leads').insert(group);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ inserted: valid.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload leads' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  noStore();
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get('profileId');

    let query = supabase.from('leads').select('*');
    if (profileId) query = query.eq('profile_id', profileId);
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { leads: data ?? [] },
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
    const body = await req.json();

    if (!body.linkedin_url || typeof body.linkedin_url !== 'string') {
      return NextResponse.json({ error: 'linkedin_url is required' }, { status: 400 });
    }

    if (!body.profile_id || typeof body.profile_id !== 'string') {
      return NextResponse.json({ error: 'profile_id is required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const insert: Record<string, unknown> = {
      profile_id: body.profile_id,
      linkedin_url: body.linkedin_url.trim(),
      first_name: body.first_name || '',
      last_name: body.last_name || '',
      company: body.company || '',
      title: body.title || '',
      extra_data: body.extra_data || {},
    };

    const { data, error } = await supabase
      .from('leads')
      .insert(insert)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ lead: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create lead' },
      { status: 500 }
    );
  }
}

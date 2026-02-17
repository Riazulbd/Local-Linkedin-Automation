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

    let query = supabase.from('workflows').select('*');
    if (profileId) query = query.eq('profile_id', profileId);
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { workflows: data ?? [] },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load workflows' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const supabase = createServiceClient();

    if (typeof body.profile_id !== 'string' || !body.profile_id.trim()) {
      return NextResponse.json({ error: 'profile_id is required' }, { status: 400 });
    }

    const insert: Record<string, unknown> = {
      profile_id: body.profile_id.trim(),
      name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Untitled Workflow',
      description: typeof body.description === 'string' ? body.description : null,
      nodes: Array.isArray(body.nodes) ? body.nodes : [],
      edges: Array.isArray(body.edges) ? body.edges : [],
      is_active: Boolean(body.is_active),
    };

    const { data, error } = await supabase
      .from('workflows')
      .insert(insert)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ workflow: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create workflow' },
      { status: 500 }
    );
  }
}

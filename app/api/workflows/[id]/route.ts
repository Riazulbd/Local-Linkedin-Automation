import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(_req: Request, { params }: RouteContext) {
  noStore();
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 500 });
    }

    return NextResponse.json(
      { workflow: data },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load workflow' },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request, { params }: RouteContext) {
  try {
    const body = await req.json();
    const supabase = createServiceClient();

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.name === 'string') payload.name = body.name;
    if (typeof body.description === 'string' || body.description === null) payload.description = body.description;
    if (Array.isArray(body.nodes)) payload.nodes = body.nodes;
    if (Array.isArray(body.edges)) payload.edges = body.edges;
    if (typeof body.is_active === 'boolean') payload.is_active = body.is_active;

    const { data, error } = await supabase
      .from('workflows')
      .update(payload)
      .eq('id', params.id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ workflow: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update workflow' },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from('workflows').delete().eq('id', params.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete workflow' },
      { status: 500 }
    );
  }
}

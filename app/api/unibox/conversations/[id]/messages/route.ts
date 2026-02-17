import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getUniboxMessages } from '@/lib/supabase/queries/unibox.queries';

interface RouteContext {
  params: { id: string };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_: Request, { params }: RouteContext) {
  try {
    const messages = await getUniboxMessages(createServiceClient(), params.id);
    return NextResponse.json(
      { messages },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load conversation messages' },
      { status: 500 }
    );
  }
}

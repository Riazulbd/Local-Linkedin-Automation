import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getUniboxSyncStatus } from '@/lib/supabase/queries/unibox.queries';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get('profileId') ?? undefined;
    const status = await getUniboxSyncStatus(createServiceClient(), profileId);
    return NextResponse.json(
      { status },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load unibox sync status' },
      { status: 500 }
    );
  }
}

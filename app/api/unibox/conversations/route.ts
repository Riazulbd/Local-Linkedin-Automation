import { NextResponse } from 'next/server';
import { BUN_SERVER_SECRET, BUN_SERVER_URL } from '@/lib/config/constants';
import { createServiceClient } from '@/lib/supabase/server';
import { getUniboxConversations } from '@/lib/supabase/queries/unibox.queries';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get('profileId') ?? undefined;
    const conversations = await getUniboxConversations(createServiceClient(), profileId);
    return NextResponse.json(
      { conversations },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load conversations' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    if (!BUN_SERVER_URL || !BUN_SERVER_SECRET) {
      return NextResponse.json({ error: 'Missing bun server config' }, { status: 500 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      profileId?: string;
      allProfiles?: boolean;
    };

    if (!body.allProfiles && !body.profileId) {
      return NextResponse.json({ error: 'profileId or allProfiles=true is required' }, { status: 400 });
    }

    const response = await fetch(`${BUN_SERVER_URL}/unibox/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-server-secret': BUN_SERVER_SECRET,
      },
      body: JSON.stringify({
        profileId: body.profileId,
        allProfiles: body.allProfiles === true,
      }),
    });

    const payload = await response.json().catch(() => ({ error: 'Invalid response from bun server' }));
    if (!response.ok) {
      return NextResponse.json(payload, { status: response.status });
    }

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync unibox conversations' },
      { status: 500 }
    );
  }
}

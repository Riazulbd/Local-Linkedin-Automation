import { NextResponse } from 'next/server';
import { BUN_SERVER_SECRET, BUN_SERVER_URL } from '@/lib/config/constants';
import { createServiceClient } from '@/lib/supabase/server';
import { setCampaignStatus } from '@/lib/supabase/queries/campaigns.queries';

interface RouteContext {
  params: { id: string };
}

export async function POST(_: Request, { params }: RouteContext) {
  try {
    if (!BUN_SERVER_URL || !BUN_SERVER_SECRET) {
      return NextResponse.json({ error: 'Missing bun server config' }, { status: 500 });
    }

    const response = await fetch(`${BUN_SERVER_URL}/campaigns/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-server-secret': BUN_SERVER_SECRET,
      },
      body: JSON.stringify({ campaignId: params.id }),
    });
    const payload = await response.json().catch(() => ({ error: 'Invalid response from bun server' }));
    if (!response.ok) {
      return NextResponse.json(payload, { status: response.status });
    }

    await setCampaignStatus(createServiceClient(), params.id, 'paused');
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to stop campaign' },
      { status: 500 }
    );
  }
}

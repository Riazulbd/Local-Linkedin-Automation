import { NextResponse } from 'next/server';
import { BUN_SERVER_URL, BUN_SERVER_SECRET } from '@/lib/config/constants';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    if (!BUN_SERVER_URL || !BUN_SERVER_SECRET) {
      return NextResponse.json({ error: 'Missing BUN_SERVER_URL or BUN_SERVER_SECRET' }, { status: 500 });
    }

    const response = await fetch(`${BUN_SERVER_URL}/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-server-secret': BUN_SERVER_SECRET,
      },
      body: JSON.stringify({ linkedinProfileId: body.linkedinProfileId }),
    });

    const payload = await response.json().catch(() => ({ stopped: false }));

    if (!response.ok) {
      return NextResponse.json(payload, { status: response.status });
    }

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to stop automation' },
      { status: 500 }
    );
  }
}

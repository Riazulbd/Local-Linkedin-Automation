import { NextRequest, NextResponse } from 'next/server';
import { BUN_SERVER_SECRET, BUN_SERVER_URL } from '@/lib/config/constants';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!BUN_SERVER_URL || !BUN_SERVER_SECRET) {
      return NextResponse.json({ error: 'Missing BUN_SERVER_URL or BUN_SERVER_SECRET' }, { status: 500 });
    }

    const response = await fetch(`${BUN_SERVER_URL}/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-server-secret': BUN_SERVER_SECRET,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    });

    const payload = await response.json().catch(() => ({ success: false, error: 'Invalid Bun response' }));

    if (!response.ok) {
      return NextResponse.json(payload, { status: response.status });
    }

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json(
        {
          success: false,
          error:
            'Automation test timed out. Make sure bun-server is running in an interactive terminal where Chromium can open visibly.',
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run test' },
      { status: 500 }
    );
  }
}

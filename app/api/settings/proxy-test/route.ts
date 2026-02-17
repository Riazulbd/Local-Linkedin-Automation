import { NextResponse } from 'next/server';
import { BUN_SERVER_URL, BUN_SERVER_SECRET } from '@/lib/config/constants';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.host || !body.port || !body.username || !body.password) {
      return NextResponse.json({ error: 'host, port, username, password are required' }, { status: 400 });
    }

    if (!BUN_SERVER_URL || !BUN_SERVER_SECRET) {
      return NextResponse.json({ error: 'Missing BUN_SERVER_URL or BUN_SERVER_SECRET' }, { status: 500 });
    }

    const response = await fetch(`${BUN_SERVER_URL}/proxy-test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-server-secret': BUN_SERVER_SECRET,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    const result = await response.json().catch(() => ({ success: false, error: 'Invalid response' }));
    if (!response.ok) {
      return NextResponse.json(result, { status: response.status });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Proxy test failed' },
      { status: 500 }
    );
  }
}

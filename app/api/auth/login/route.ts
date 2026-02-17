import { NextResponse } from 'next/server';
import { BUN_SERVER_SECRET, BUN_SERVER_URL } from '@/lib/config/constants';

export async function POST(req: Request) {
  try {
    if (!BUN_SERVER_URL || !BUN_SERVER_SECRET) {
      return NextResponse.json({ error: 'Missing bun server config' }, { status: 500 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      profileId?: string;
      email?: string;
      password?: string;
    };

    if (!body.profileId || !body.email || !body.password) {
      return NextResponse.json(
        { error: 'profileId, email, and password are required' },
        { status: 400 }
      );
    }

    const response = await fetch(`${BUN_SERVER_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-server-secret': BUN_SERVER_SECRET,
      },
      body: JSON.stringify({
        profileId: body.profileId,
        email: body.email,
        password: body.password,
      }),
    });

    const payload = await response.json().catch(() => ({ error: 'Invalid response from bun server' }));
    if (!response.ok) {
      return NextResponse.json(payload, { status: response.status });
    }

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start LinkedIn login' },
      { status: 500 }
    );
  }
}

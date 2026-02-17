import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { setPendingTwoFACode } from '@/lib/supabase/queries/profiles.queries';

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      profileId?: string;
      code?: string;
    };

    if (!body.profileId || !body.code) {
      return NextResponse.json({ error: 'profileId and code are required' }, { status: 400 });
    }

    await setPendingTwoFACode(createServiceClient(), body.profileId, body.code.trim());
    return NextResponse.json({ accepted: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit 2FA code' },
      { status: 500 }
    );
  }
}

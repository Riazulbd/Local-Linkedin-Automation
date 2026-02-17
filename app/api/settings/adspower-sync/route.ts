import { NextResponse } from 'next/server';
import { adsPowerListProfiles, adsPowerIsReachable } from '@/lib/api/adspower.client';

export async function POST() {
  try {
    const reachable = await adsPowerIsReachable();
    if (!reachable) {
      return NextResponse.json({ error: 'AdsPower is not reachable' }, { status: 503 });
    }

    const profiles = await adsPowerListProfiles();
    return NextResponse.json({ profiles });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync AdsPower profiles' },
      { status: 500 }
    );
  }
}

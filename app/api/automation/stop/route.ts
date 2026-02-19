import { NextRequest, NextResponse } from 'next/server';
import { BUN_SERVER_URL, BUN_SERVER_SECRET } from '@/lib/config/constants';
import { createServiceClient } from '@/lib/supabase/server';

type StopRequestBody = {
  runId?: string;
  profileId?: string;
  linkedinProfileId?: string;
  campaignId?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as StopRequestBody;

    if (!BUN_SERVER_URL || !BUN_SERVER_SECRET) {
      return NextResponse.json({ error: 'Missing BUN_SERVER_URL or BUN_SERVER_SECRET' }, { status: 500 });
    }

    const supabase = createServiceClient();
    const now = new Date().toISOString();
    const runId = typeof body.runId === 'string' ? body.runId : undefined;
    let profileId =
      (typeof body.profileId === 'string' && body.profileId) ||
      (typeof body.linkedinProfileId === 'string' && body.linkedinProfileId) ||
      '';
    let campaignId = typeof body.campaignId === 'string' ? body.campaignId : '';

    if (runId) {
      await supabase
        .from('execution_runs')
        .update({ status: 'stopped', completed_at: now })
        .eq('id', runId)
        .eq('status', 'running');

      if (!profileId || !campaignId) {
        const { data: runRow } = await supabase
          .from('execution_runs')
          .select('profile_id, campaign_id')
          .eq('id', runId)
          .maybeSingle();

        profileId = profileId || String((runRow as { profile_id?: string | null } | null)?.profile_id || '');
        campaignId = campaignId || String((runRow as { campaign_id?: string | null } | null)?.campaign_id || '');
      }
    }

    if (campaignId) {
      await supabase
        .from('campaigns')
        .update({ status: 'paused', updated_at: now })
        .eq('id', campaignId);
    }

    const response = await fetch(`${BUN_SERVER_URL}/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-server-secret': BUN_SERVER_SECRET,
      },
      body: JSON.stringify({
        runId,
        profileId: profileId || undefined,
        linkedinProfileId: profileId || undefined,
        campaignId: campaignId || undefined,
      }),
    });

    const payload = await response.json().catch(() => ({ stopped: false, error: 'Invalid response from bun-server' }));

    if (!response.ok) {
      return NextResponse.json(payload, { status: response.status });
    }

    return NextResponse.json({
      success: true,
      runId: runId || null,
      profileId: profileId || null,
      campaignId: campaignId || null,
      ...payload,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to stop automation' },
      { status: 500 }
    );
  }
}

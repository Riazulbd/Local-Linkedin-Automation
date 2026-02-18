import { NextRequest, NextResponse } from 'next/server';
import { BUN_SERVER_SECRET, BUN_SERVER_URL } from '@/lib/config/constants';
import { createServiceClient } from '@/lib/supabase/server';
import { completeExecutionRun, createTestExecutionRun } from '@/lib/supabase/queries/executions.queries';
import { getLeadById } from '@/lib/supabase/queries/leads.queries';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      nodeType?: string;
      action?: string;
      nodeData?: Record<string, unknown>;
      linkedinUrl?: string;
      testUrl?: string;
      linkedinProfileId?: string;
      profileId?: string;
      leadId?: string;
      messageTemplate?: string;
    };

    if (!BUN_SERVER_URL || !BUN_SERVER_SECRET) {
      return NextResponse.json({ error: 'Missing BUN_SERVER_URL or BUN_SERVER_SECRET' }, { status: 500 });
    }

    const profileId = body.linkedinProfileId || body.profileId;
    if (!profileId) {
      return NextResponse.json({ error: 'linkedinProfileId/profileId is required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const leadId = typeof body.leadId === 'string' ? body.leadId : undefined;
    const lead = leadId ? await getLeadById(supabase, leadId) : null;

    if (leadId && !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const run = await createTestExecutionRun(supabase, profileId);

    const nodeData =
      body.action === 'message' && body.messageTemplate && !body.nodeData
        ? { messageTemplate: body.messageTemplate }
        : body.nodeData ?? {};

    const response = await fetch(`${BUN_SERVER_URL}/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-server-secret': BUN_SERVER_SECRET,
      },
      body: JSON.stringify({
        ...body,
        runId: run.id,
        profileId,
        linkedinProfileId: profileId,
        lead,
        leadId,
        nodeData,
        linkedinUrl: lead?.linkedin_url || body.linkedinUrl || body.testUrl,
        isTest: true,
      }),
      signal: AbortSignal.timeout(120000),
    });

    const payload = await response.json().catch(() => ({ success: false, error: 'Invalid Bun response' }));

    if (payload && typeof payload.success === 'boolean') {
      await completeExecutionRun(
        supabase,
        run.id,
        payload.success ? 'completed' : 'failed',
        payload.success ? 1 : 0,
        payload.success ? 0 : 1
      ).catch(() => undefined);
    }

    if (!response.ok) {
      return NextResponse.json({ runId: run.id, ...payload }, { status: response.status });
    }

    return NextResponse.json({ runId: run.id, ...payload });
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

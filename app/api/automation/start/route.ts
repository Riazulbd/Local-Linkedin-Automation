import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { BUN_SERVER_URL, BUN_SERVER_SECRET } from '@/lib/config/constants';

export async function POST(req: NextRequest) {
  try {
    const { workflowId, linkedinProfileId, leadIds } = await req.json();

    if (!workflowId || typeof workflowId !== 'string') {
      return NextResponse.json({ error: 'workflowId is required' }, { status: 400 });
    }

    if (!linkedinProfileId || typeof linkedinProfileId !== 'string') {
      return NextResponse.json({ error: 'linkedinProfileId is required' }, { status: 400 });
    }

    const selectedLeadIds = Array.isArray(leadIds)
      ? leadIds.filter((id: unknown): id is string => typeof id === 'string')
      : [];

    const supabase = createServiceClient();

    const { data: workflowData, error: workflowError } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', workflowId)
      .single();

    const workflow = workflowData as { profile_id: string | null; nodes: unknown[]; edges: unknown[] } | null;

    if (workflowError || !workflow) {
      return NextResponse.json({ error: workflowError?.message || 'Workflow not found' }, { status: 404 });
    }

    if (workflow.profile_id && workflow.profile_id !== linkedinProfileId) {
      return NextResponse.json({ error: 'Workflow does not belong to the selected profile' }, { status: 400 });
    }

    let leadsQuery = supabase
      .from('leads')
      .select('*')
      .eq('status', 'pending')
      .eq('profile_id', linkedinProfileId);
    if (selectedLeadIds.length) {
      leadsQuery = leadsQuery.in('id', selectedLeadIds);
    }

    const { data: leads, error: leadsError } = await leadsQuery;

    if (leadsError) {
      return NextResponse.json({ error: leadsError.message }, { status: 500 });
    }

    if (!leads?.length) {
      return NextResponse.json({ error: 'No eligible pending leads found' }, { status: 400 });
    }

    if (!BUN_SERVER_URL || !BUN_SERVER_SECRET) {
      return NextResponse.json({ error: 'Missing BUN_SERVER_URL or BUN_SERVER_SECRET' }, { status: 500 });
    }

    const response = await fetch(`${BUN_SERVER_URL}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-server-secret': BUN_SERVER_SECRET,
      },
      body: JSON.stringify({
        workflowId,
        linkedinProfileId,
        leads,
        nodes: workflow.nodes,
        edges: workflow.edges,
      }),
    });

    const payload = await response.json().catch(() => ({ error: 'Invalid response from Bun server' }));

    if (!response.ok) {
      return NextResponse.json(payload, { status: response.status });
    }

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start automation' },
      { status: 500 }
    );
  }
}

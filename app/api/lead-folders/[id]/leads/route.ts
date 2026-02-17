import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  assignLeadsToFolder,
  clearLeadsFromFolder,
  refreshFolderLeadCount,
} from '@/lib/supabase/queries/lead-folders.queries';

interface RouteContext {
  params: { id: string };
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      leadIds?: string[];
      action?: 'assign' | 'clear';
    };

    const leadIds = Array.isArray(body.leadIds)
      ? body.leadIds.filter((id): id is string => typeof id === 'string')
      : [];

    if (leadIds.length === 0) {
      return NextResponse.json({ error: 'leadIds is required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const action = body.action || 'assign';
    const updated =
      action === 'clear'
        ? await clearLeadsFromFolder(supabase, params.id, leadIds)
        : await assignLeadsToFolder(supabase, params.id, leadIds);

    await refreshFolderLeadCount(supabase, params.id);

    return NextResponse.json({
      updated,
      action,
      folderId: params.id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed updating leads in folder' },
      { status: 500 }
    );
  }
}

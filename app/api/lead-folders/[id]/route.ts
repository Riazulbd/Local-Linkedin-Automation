import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  deleteLeadFolder,
  getLeadFolderById,
  updateLeadFolder,
} from '@/lib/supabase/queries/lead-folders.queries';

interface RouteContext {
  params: { id: string };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_: Request, { params }: RouteContext) {
  try {
    const folder = await getLeadFolderById(createServiceClient(), params.id);
    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }
    return NextResponse.json({ folder });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load folder' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const folder = await updateLeadFolder(createServiceClient(), params.id, {
      name: typeof body.name === 'string' ? body.name : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      color: typeof body.color === 'string' ? body.color : undefined,
    });
    return NextResponse.json({ folder });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update folder' },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, { params }: RouteContext) {
  try {
    await deleteLeadFolder(createServiceClient(), params.id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete folder' },
      { status: 500 }
    );
  }
}

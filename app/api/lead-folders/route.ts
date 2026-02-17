import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createLeadFolder, getLeadFolders } from '@/lib/supabase/queries/lead-folders.queries';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const folders = await getLeadFolders(createServiceClient());
    return NextResponse.json(
      { folders },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load folders' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const folder = await createLeadFolder(createServiceClient(), {
      name: body.name.trim(),
      description: typeof body.description === 'string' ? body.description : undefined,
      color: typeof body.color === 'string' ? body.color : undefined,
    });

    return NextResponse.json({ folder }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create folder' },
      { status: 500 }
    );
  }
}

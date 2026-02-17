import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getProfileById, updateProfile, deleteProfile } from '@/lib/supabase/queries/profiles.queries';

interface RouteContext {
  params: { id: string };
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const supabase = createServiceClient();
    const profile = await getProfileById(supabase, params.id);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load profile' },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request, { params }: RouteContext) {
  try {
    const body = await req.json();
    const supabase = createServiceClient();
    const profile = await updateProfile(supabase, params.id, body);
    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update profile' },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const supabase = createServiceClient();
    await deleteProfile(supabase, params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete profile' },
      { status: 500 }
    );
  }
}

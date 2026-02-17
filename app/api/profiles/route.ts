import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAllProfiles, createProfile } from '@/lib/supabase/queries/profiles.queries';

export async function GET() {
  try {
    const supabase = createServiceClient();
    const profiles = await getAllProfiles(supabase);
    return NextResponse.json({ profiles });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load profiles' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supabase = createServiceClient();

    if (!body.name || !body.adspower_profile_id) {
      return NextResponse.json({ error: 'name and adspower_profile_id are required' }, { status: 400 });
    }

    const profile = await createProfile(supabase, {
      name: body.name,
      linkedin_email: body.linkedin_email,
      adspower_profile_id: body.adspower_profile_id,
      brightdata_host: body.brightdata_host,
      brightdata_port: body.brightdata_port,
      brightdata_username: body.brightdata_username,
      brightdata_password: body.brightdata_password,
      avatar_color: body.avatar_color,
    });

    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create profile' },
      { status: 500 }
    );
  }
}

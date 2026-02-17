import { NextResponse } from 'next/server';
import { BUN_SERVER_SECRET, BUN_SERVER_URL } from '@/lib/config/constants';
import { createServiceClient } from '@/lib/supabase/server';
import { deleteProfile, getProfileById, updateProfile } from '@/lib/supabase/queries/profiles.queries';

interface RouteContext {
  params: { id: string };
}

async function maybeCreateAdsPowerProfile(body: Record<string, unknown>) {
  let adspowerProfileId = typeof body.adspower_profile_id === 'string' ? body.adspower_profile_id : '';
  const autoCreate = body.auto_create_adspower === true;

  if (!adspowerProfileId && autoCreate) {
    if (!BUN_SERVER_URL || !BUN_SERVER_SECRET) {
      throw new Error('Missing bun server config for auto-create AdsPower profile');
    }

    const res = await fetch(`${BUN_SERVER_URL}/adspower/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-server-secret': BUN_SERVER_SECRET,
      },
      body: JSON.stringify({
        name: typeof body.name === 'string' ? body.name : 'LinkedIn Profile',
        proxyHost: typeof body.brightdata_host === 'string' ? body.brightdata_host : undefined,
        proxyPort: typeof body.brightdata_port === 'number' ? body.brightdata_port : undefined,
        proxyUser: typeof body.brightdata_username === 'string' ? body.brightdata_username : undefined,
        proxyPass: typeof body.brightdata_password === 'string' ? body.brightdata_password : undefined,
      }),
    });

    const payload = await res.json().catch(() => ({ error: 'Invalid AdsPower create response' }));
    if (!res.ok || !payload.profileId) {
      throw new Error(payload.error || 'Failed to auto-create AdsPower profile');
    }

    adspowerProfileId = String(payload.profileId);
  }

  return adspowerProfileId || undefined;
}

async function maybeEncryptCredentials(body: Record<string, unknown>) {
  const email = typeof body.linkedin_email === 'string' ? body.linkedin_email.trim() : '';
  const password = typeof body.linkedin_password === 'string' ? body.linkedin_password : '';

  if (!email || !password) {
    return { encEmail: undefined, encPassword: undefined };
  }

  if (!BUN_SERVER_URL || !BUN_SERVER_SECRET) {
    throw new Error('Missing bun server config for credential encryption');
  }

  const encRes = await fetch(`${BUN_SERVER_URL}/encrypt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-server-secret': BUN_SERVER_SECRET,
    },
    body: JSON.stringify({ email, password }),
  });

  const encPayload = await encRes.json().catch(() => ({ error: 'Invalid encryption response' }));
  if (!encRes.ok || !encPayload.encEmail || !encPayload.encPassword) {
    throw new Error(encPayload.error || 'Failed to encrypt credentials');
  }

  return {
    encEmail: String(encPayload.encEmail),
    encPassword: String(encPayload.encPassword),
  };
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const profile = await getProfileById(createServiceClient(), params.id);
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
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const supabase = createServiceClient();

    const adspowerProfileId = await maybeCreateAdsPowerProfile(body);
    const { encEmail, encPassword } = await maybeEncryptCredentials(body);

    const profile = await updateProfile(supabase, params.id, {
      name: typeof body.name === 'string' ? body.name : undefined,
      adspower_profile_id: adspowerProfileId,
      brightdata_host: typeof body.brightdata_host === 'string' ? body.brightdata_host : undefined,
      brightdata_port: typeof body.brightdata_port === 'number' ? body.brightdata_port : undefined,
      brightdata_username: typeof body.brightdata_username === 'string' ? body.brightdata_username : undefined,
      brightdata_password: typeof body.brightdata_password === 'string' ? body.brightdata_password : undefined,
      linkedin_email_encrypted: encEmail,
      linkedin_password_encrypted: encPassword,
      login_status: encEmail && encPassword ? 'logged_out' : undefined,
      linkedin_email: undefined,
    });

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
    await deleteProfile(createServiceClient(), params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete profile' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { BUN_SERVER_SECRET, BUN_SERVER_URL } from '@/lib/config/constants';
import { createServiceClient } from '@/lib/supabase/server';
import { logAppAction } from '@/lib/supabase/queries/action-logs.queries';
import { createProfile, getAllProfiles } from '@/lib/supabase/queries/profiles.queries';

function sanitizeProfileRequest(body: Record<string, unknown>) {
  return {
    name: typeof body.name === 'string' ? body.name.trim() : null,
    adspower_profile_id:
      typeof body.adspower_profile_id === 'string' ? body.adspower_profile_id.trim() : null,
    auto_create_adspower: body.auto_create_adspower === true,
    brightdata_host:
      typeof body.brightdata_host === 'string' ? body.brightdata_host.trim() : null,
    brightdata_port: typeof body.brightdata_port === 'number' ? body.brightdata_port : null,
    brightdata_username:
      typeof body.brightdata_username === 'string' ? body.brightdata_username.trim() : null,
    has_linkedin_email:
      typeof body.linkedin_email === 'string' ? body.linkedin_email.trim().length > 0 : false,
    has_linkedin_password:
      typeof body.linkedin_password === 'string' ? body.linkedin_password.length > 0 : false,
  };
}

async function maybeCreateAdsPowerProfile(body: Record<string, unknown>) {
  let adspowerProfileId = typeof body.adspower_profile_id === 'string' ? body.adspower_profile_id : '';

  const autoCreate = body.auto_create_adspower === true;
  if (!adspowerProfileId && autoCreate) {
    if (!BUN_SERVER_URL || !BUN_SERVER_SECRET) {
      throw new Error('Missing bun server config for auto-create AdsPower profile');
    }

    let res: Response;
    try {
      res = await fetch(`${BUN_SERVER_URL}/adspower/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-server-secret': BUN_SERVER_SECRET,
        },
        body: JSON.stringify({
          name: String(body.name || 'LinkedIn Profile'),
          proxyHost: typeof body.brightdata_host === 'string' ? body.brightdata_host : undefined,
          proxyPort: typeof body.brightdata_port === 'number' ? body.brightdata_port : undefined,
          proxyUser: typeof body.brightdata_username === 'string' ? body.brightdata_username : undefined,
          proxyPass: typeof body.brightdata_password === 'string' ? body.brightdata_password : undefined,
        }),
      });
    } catch (error) {
      throw new Error(
        `Failed to reach bun-server at ${BUN_SERVER_URL} for AdsPower auto-create: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    const payload = await res.json().catch(() => ({ error: 'Invalid AdsPower create response' }));
    if (!res.ok || !payload.profileId) {
      throw new Error(payload.error || 'Failed to auto-create AdsPower profile');
    }

    adspowerProfileId = String(payload.profileId);
  }

  return adspowerProfileId;
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

  let encRes: Response;
  try {
    encRes = await fetch(`${BUN_SERVER_URL}/encrypt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-server-secret': BUN_SERVER_SECRET,
      },
      body: JSON.stringify({ email, password }),
    });
  } catch (error) {
    throw new Error(
      `Failed to reach bun-server at ${BUN_SERVER_URL} for credential encryption: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  const encPayload = await encRes.json().catch(() => ({ error: 'Invalid encryption response' }));
  if (!encRes.ok || !encPayload.encEmail || !encPayload.encPassword) {
    throw new Error(encPayload.error || 'Failed to encrypt credentials');
  }

  return {
    encEmail: String(encPayload.encEmail),
    encPassword: String(encPayload.encPassword),
  };
}

export async function GET() {
  try {
    const profiles = await getAllProfiles(createServiceClient());
    return NextResponse.json({ profiles });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load profiles' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const rawBody = await req.json().catch(() => ({}));
  const body =
    rawBody && typeof rawBody === 'object'
      ? (rawBody as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  const supabase = createServiceClient();
  const requestSnapshot = sanitizeProfileRequest(body);

  try {
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      await logAppAction(supabase, {
        actionType: 'profile.create',
        entityType: 'linkedin_profile',
        status: 'error',
        requestData: requestSnapshot,
        errorMessage: 'name is required',
      }).catch(() => undefined);
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const adspowerProfileId = await maybeCreateAdsPowerProfile(body);
    if (!adspowerProfileId) {
      await logAppAction(supabase, {
        actionType: 'profile.create',
        entityType: 'linkedin_profile',
        status: 'error',
        requestData: requestSnapshot,
        errorMessage: 'adspower_profile_id is required',
      }).catch(() => undefined);
      return NextResponse.json(
        { error: 'adspower_profile_id is required (or enable auto_create_adspower)' },
        { status: 400 }
      );
    }

    const { encEmail, encPassword } = await maybeEncryptCredentials(body);

    const profile = await createProfile(supabase, {
      name: body.name.trim(),
      adspower_profile_id: adspowerProfileId,
      brightdata_host: typeof body.brightdata_host === 'string' ? body.brightdata_host : undefined,
      brightdata_port: typeof body.brightdata_port === 'number' ? body.brightdata_port : undefined,
      brightdata_username: typeof body.brightdata_username === 'string' ? body.brightdata_username : undefined,
      brightdata_password: typeof body.brightdata_password === 'string' ? body.brightdata_password : undefined,
      avatar_color: typeof body.avatar_color === 'string' ? body.avatar_color : undefined,
      linkedin_email_encrypted: encEmail,
      linkedin_password_encrypted: encPassword,
      login_status: encEmail && encPassword ? 'logged_out' : undefined,
      // Never persist plaintext credentials.
      linkedin_email: undefined,
    });
    await logAppAction(supabase, {
      actionType: 'profile.create',
      entityType: 'linkedin_profile',
      entityId: profile.id,
      status: 'success',
      requestData: requestSnapshot,
      responseData: { profile_id: profile.id, adspower_profile_id: profile.adspower_profile_id },
    }).catch(() => undefined);

    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    await logAppAction(supabase, {
      actionType: 'profile.create',
      entityType: 'linkedin_profile',
      status: 'error',
      requestData: requestSnapshot,
      errorMessage: error instanceof Error ? error.message : 'Failed to create profile',
    }).catch(() => undefined);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create profile' },
      { status: 500 }
    );
  }
}

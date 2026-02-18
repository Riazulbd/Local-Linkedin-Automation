'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useTwoFAContext } from '@/lib/context/TwoFAContext';
import type { LinkedInProfile } from '@/types';

export default function EditProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id || '');

  const { submitCode, isSubmitting: isSubmittingTwoFA } = useTwoFAContext();
  const supabase = useMemo(() => createClient(), []);

  const [profile, setProfile] = useState<LinkedInProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingLogin, setIsTestingLogin] = useState(false);
  const [isStoppingBrowser, setIsStoppingBrowser] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [autoCreateAdsPower, setAutoCreateAdsPower] = useState(false);
  const [adspowerId, setAdspowerId] = useState('');
  const [brightdataHost, setBrightdataHost] = useState('');
  const [brightdataPort, setBrightdataPort] = useState('');
  const [brightdataUsername, setBrightdataUsername] = useState('');
  const [brightdataPassword, setBrightdataPassword] = useState('');
  const [linkedinEmail, setLinkedinEmail] = useState('');
  const [linkedinPassword, setLinkedinPassword] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');

  async function loadProfile() {
    const response = await fetch(`/api/profiles/${id}`, { cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || 'Failed to load profile');
    }

    const next = payload.profile as LinkedInProfile;
    setProfile(next);
    setName(next.name || '');
    setAdspowerId(next.adspower_profile_id || '');
    setBrightdataHost(next.brightdata_host || '');
    setBrightdataPort(next.brightdata_port?.toString() || '');
    setBrightdataUsername(next.brightdata_username || '');
    setBrightdataPassword(next.brightdata_password || '');
  }

  useEffect(() => {
    loadProfile()
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Failed to load profile'))
      .finally(() => setIsLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`profile-realtime-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'linkedin_profiles',
          filter: `id=eq.${id}`,
        },
        () => {
          loadProfile().catch(() => undefined);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(() => undefined);
    };
  }, [id, supabase]);

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/profiles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          auto_create_adspower: autoCreateAdsPower,
          adspower_profile_id: autoCreateAdsPower ? undefined : adspowerId.trim(),
          brightdata_host: brightdataHost.trim() || undefined,
          brightdata_port: brightdataPort ? Number.parseInt(brightdataPort, 10) : undefined,
          brightdata_username: brightdataUsername.trim() || undefined,
          brightdata_password: brightdataPassword || undefined,
          linkedin_email: linkedinEmail.trim() || undefined,
          linkedin_password: linkedinPassword || undefined,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update profile');
      }

      setMessage('Profile saved successfully');
      setLinkedinPassword('');
      await loadProfile();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  }

  async function testLogin() {
    if (!profile) return;

    setIsTestingLogin(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: profile.id,
          email: linkedinEmail.trim() || undefined,
          password: linkedinPassword || undefined,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Login test failed');
      }

      if (payload.requires2fa || payload.outcome === '2fa_required') {
        setMessage('2FA challenge detected. Submit the verification code below.');
      } else if (payload.success) {
        setMessage(`Login success (${payload.outcome || 'logged_in'})`);
      } else {
        setMessage(`Login result: ${payload.outcome || 'unknown'}`);
      }

      setLinkedinPassword('');
      await loadProfile();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Login test failed');
    } finally {
      setIsTestingLogin(false);
    }
  }

  async function submitTwoFaCode() {
    if (!profile || !twoFaCode.trim()) return;
    setError(null);
    setMessage(null);

    try {
      await submitCode(profile.id, twoFaCode.trim());
      setTwoFaCode('');
      setMessage('2FA code submitted. Waiting for login status update...');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to submit 2FA code');
    }
  }

  async function stopBrowserSession() {
    if (!profile) return;

    setIsStoppingBrowser(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/profiles/${profile.id}/stop-browser`, {
        method: 'POST',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to close browser session');
      }

      setMessage('Browser session closed for this profile');
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : 'Failed to close browser session');
    } finally {
      setIsStoppingBrowser(false);
    }
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-text-faint">Loading...</div>;
  }

  if (!profile) {
    return <div className="p-6 text-sm text-red-400">Profile not found</div>;
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="mb-6 flex items-center gap-3">
          <Link href="/settings/profiles" className="text-text-muted transition hover:text-text-primary">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-bold text-text-primary">Edit Profile</h1>
        </div>

        {profile.login_status === '2fa_pending' && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-xs font-semibold text-amber-200">Two-factor verification required</p>
            <p className="mt-1 text-xs text-amber-100/90">
              Challenge type: {profile.twofa_challenge_type || 'unknown'}
            </p>
            <div className="mt-2 flex gap-2">
              <input
                value={twoFaCode}
                onChange={(event) => setTwoFaCode(event.target.value)}
                placeholder="Enter code"
                className="flex-1 rounded-md border border-amber-400/30 bg-black/20 px-2.5 py-2 text-xs text-amber-50 outline-none"
              />
              <button
                type="button"
                onClick={submitTwoFaCode}
                disabled={isSubmittingTwoFA || !twoFaCode.trim()}
                className="rounded-md border border-amber-400/40 px-3 py-2 text-xs text-amber-100 hover:bg-amber-500/20 disabled:opacity-60"
              >
                Submit
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>
        )}

        {message && (
          <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">{message}</p>
        )}

        <div className="space-y-4 rounded-xl border border-border bg-bg-surface p-5">
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="rounded-md border border-border bg-bg-base px-2.5 py-2 text-xs text-text-primary outline-none focus:border-accent"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              LinkedIn Login Email
              <input
                value={linkedinEmail}
                onChange={(event) => setLinkedinEmail(event.target.value)}
                className="rounded-md border border-border bg-bg-base px-2.5 py-2 text-xs text-text-primary outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              LinkedIn Login Password
              <input
                type="password"
                value={linkedinPassword}
                onChange={(event) => setLinkedinPassword(event.target.value)}
                className="rounded-md border border-border bg-bg-base px-2.5 py-2 text-xs text-text-primary outline-none focus:border-accent"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={autoCreateAdsPower}
              onChange={(event) => setAutoCreateAdsPower(event.target.checked)}
            />
            Auto-create AdsPower profile if ID is empty
          </label>

          {!autoCreateAdsPower && (
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              AdsPower Profile ID
              <input
                value={adspowerId}
                onChange={(event) => setAdspowerId(event.target.value)}
                className="rounded-md border border-border bg-bg-base px-2.5 py-2 text-xs text-text-primary outline-none focus:border-accent"
              />
            </label>
          )}

          <hr className="border-border" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Bright Data Proxy</h4>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              Host
              <input
                value={brightdataHost}
                onChange={(event) => setBrightdataHost(event.target.value)}
                placeholder="brd.superproxy.io"
                className="rounded-md border border-border bg-bg-base px-2.5 py-2 text-xs text-text-primary outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              Port
              <input
                value={brightdataPort}
                onChange={(event) => setBrightdataPort(event.target.value)}
                placeholder="22225"
                className="rounded-md border border-border bg-bg-base px-2.5 py-2 text-xs text-text-primary outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              Username
              <input
                value={brightdataUsername}
                onChange={(event) => setBrightdataUsername(event.target.value)}
                className="rounded-md border border-border bg-bg-base px-2.5 py-2 text-xs text-text-primary outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              Password
              <input
                type="password"
                value={brightdataPassword}
                onChange={(event) => setBrightdataPassword(event.target.value)}
                className="rounded-md border border-border bg-bg-base px-2.5 py-2 text-xs text-text-primary outline-none focus:border-accent"
              />
            </label>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={stopBrowserSession}
            disabled={isStoppingBrowser}
            className="rounded-lg border border-slate-500/40 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-500/20 disabled:opacity-60"
          >
            {isStoppingBrowser ? 'Closing Browser...' : 'Stop Browser Session'}
          </button>

          <button
            type="button"
            onClick={testLogin}
            disabled={isTestingLogin}
            className="rounded-lg border border-amber-500/40 px-4 py-2 text-xs font-medium text-amber-200 hover:bg-amber-500/20 disabled:opacity-60"
          >
            {isTestingLogin ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Testing...
              </span>
            ) : (
              'Test Login'
            )}
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        <div className="text-[11px] text-text-faint">
          Current login status: <span className="font-semibold">{profile.login_status || 'unknown'}</span>
        </div>
      </div>
    </div>
  );
}

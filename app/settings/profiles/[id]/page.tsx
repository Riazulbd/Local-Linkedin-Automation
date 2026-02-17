'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import type { LinkedInProfile } from '@/types';

export default function EditProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [profile, setProfile] = useState<LinkedInProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [adspowerId, setAdspowerId] = useState('');
  const [brightdataHost, setBrightdataHost] = useState('');
  const [brightdataPort, setBrightdataPort] = useState('');
  const [brightdataUsername, setBrightdataUsername] = useState('');
  const [brightdataPassword, setBrightdataPassword] = useState('');

  useEffect(() => {
    fetch(`/api/profiles/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.profile) {
          const p = data.profile as LinkedInProfile;
          setProfile(p);
          setName(p.name);
          setEmail(p.linkedin_email || '');
          setAdspowerId(p.adspower_profile_id);
          setBrightdataHost(p.brightdata_host || '');
          setBrightdataPort(p.brightdata_port?.toString() || '');
          setBrightdataUsername(p.brightdata_username || '');
          setBrightdataPassword(p.brightdata_password || '');
        }
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/profiles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          linkedin_email: email || undefined,
          adspower_profile_id: adspowerId,
          brightdata_host: brightdataHost || undefined,
          brightdata_port: brightdataPort ? parseInt(brightdataPort) : undefined,
          brightdata_username: brightdataUsername || undefined,
          brightdata_password: brightdataPassword || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Save failed');
      }

      router.push('/settings/profiles');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-6 text-sm text-text-faint">Loading...</div>;
  if (!profile) return <div className="p-6 text-sm text-red-400">Profile not found</div>;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/settings/profiles" className="text-text-muted hover:text-text-primary transition">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-bold text-text-primary">Edit Profile</h1>
        </div>

        {error && (
          <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>
        )}

        <div className="space-y-4 rounded-xl border border-border bg-bg-surface p-5">
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Name
            <input value={name} onChange={e => setName(e.target.value)} className="rounded-md border border-border bg-bg-base px-2.5 py-2 text-xs text-text-primary outline-none focus:border-accent" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            LinkedIn Email
            <input value={email} onChange={e => setEmail(e.target.value)} className="rounded-md border border-border bg-bg-base px-2.5 py-2 text-xs text-text-primary outline-none focus:border-accent" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            AdsPower Profile ID
            <input value={adspowerId} onChange={e => setAdspowerId(e.target.value)} className="rounded-md border border-border bg-bg-base px-2.5 py-2 text-xs text-text-primary outline-none focus:border-accent" />
          </label>

          <hr className="border-border" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Bright Data Proxy</h4>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              Host
              <input value={brightdataHost} onChange={e => setBrightdataHost(e.target.value)} placeholder="brd.superproxy.io" className="rounded-md border border-border bg-bg-base px-2.5 py-2 text-xs text-text-primary outline-none focus:border-accent" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              Port
              <input value={brightdataPort} onChange={e => setBrightdataPort(e.target.value)} placeholder="22225" className="rounded-md border border-border bg-bg-base px-2.5 py-2 text-xs text-text-primary outline-none focus:border-accent" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              Username
              <input value={brightdataUsername} onChange={e => setBrightdataUsername(e.target.value)} className="rounded-md border border-border bg-bg-base px-2.5 py-2 text-xs text-text-primary outline-none focus:border-accent" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              Password
              <input value={brightdataPassword} onChange={e => setBrightdataPassword(e.target.value)} type="password" className="rounded-md border border-border bg-bg-base px-2.5 py-2 text-xs text-text-primary outline-none focus:border-accent" />
            </label>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50 transition"
          >
            <Save className="h-3.5 w-3.5" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

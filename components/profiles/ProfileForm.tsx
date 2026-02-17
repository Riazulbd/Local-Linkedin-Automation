'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useProfileStore } from '@/store/profileStore';

interface ProfileFormProps {
  onClose: () => void;
}

export function ProfileForm({ onClose }: ProfileFormProps) {
  const refreshProfiles = useProfileStore((state) => state.refreshProfiles);

  const [name, setName] = useState('');
  const [linkedinEmail, setLinkedinEmail] = useState('');
  const [linkedinPassword, setLinkedinPassword] = useState('');
  const [autoCreateAdsPower, setAutoCreateAdsPower] = useState(true);
  const [adspowerId, setAdspowerId] = useState('');
  const [brightdataHost, setBrightdataHost] = useState('');
  const [brightdataPort, setBrightdataPort] = useState('');
  const [brightdataUsername, setBrightdataUsername] = useState('');
  const [brightdataPassword, setBrightdataPassword] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && (autoCreateAdsPower || adspowerId.trim().length > 0);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/profiles', {
        method: 'POST',
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
        throw new Error(payload.error || 'Failed to create profile');
      }

      await refreshProfiles();
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create profile');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl rounded-2xl border border-border bg-bg-surface p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-text-primary">Add LinkedIn Profile</h3>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text-primary transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <p className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>
        )}

        <div className="space-y-3">
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Name *
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Profile display name"
              required
              className="rounded-md border border-border bg-bg-base px-2.5 py-2 text-xs text-text-primary outline-none focus:border-accent"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              LinkedIn Login Email
              <input
                value={linkedinEmail}
                onChange={(event) => setLinkedinEmail(event.target.value)}
                placeholder="email@example.com"
                className="rounded-md border border-border bg-bg-base px-2.5 py-2 text-xs text-text-primary outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              LinkedIn Login Password
              <input
                type="password"
                value={linkedinPassword}
                onChange={(event) => setLinkedinPassword(event.target.value)}
                placeholder="Password"
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
            Auto-create AdsPower profile
          </label>

          {!autoCreateAdsPower && (
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              AdsPower Profile ID *
              <input
                value={adspowerId}
                onChange={(event) => setAdspowerId(event.target.value)}
                placeholder="Existing AdsPower profile ID"
                className="rounded-md border border-border bg-bg-base px-2.5 py-2 text-xs text-text-primary outline-none focus:border-accent"
              />
            </label>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              Proxy Host
              <input
                value={brightdataHost}
                onChange={(event) => setBrightdataHost(event.target.value)}
                placeholder="brd.superproxy.io"
                className="rounded-md border border-border bg-bg-base px-2.5 py-2 text-xs text-text-primary outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              Proxy Port
              <input
                value={brightdataPort}
                onChange={(event) => setBrightdataPort(event.target.value)}
                placeholder="22225"
                className="rounded-md border border-border bg-bg-base px-2.5 py-2 text-xs text-text-primary outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              Proxy Username
              <input
                value={brightdataUsername}
                onChange={(event) => setBrightdataUsername(event.target.value)}
                className="rounded-md border border-border bg-bg-base px-2.5 py-2 text-xs text-text-primary outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              Proxy Password
              <input
                type="password"
                value={brightdataPassword}
                onChange={(event) => setBrightdataPassword(event.target.value)}
                className="rounded-md border border-border bg-bg-base px-2.5 py-2 text-xs text-text-primary outline-none focus:border-accent"
              />
            </label>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-text-muted hover:bg-bg-elevated transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !canSubmit}
            className="rounded-md bg-accent px-4 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50 transition"
          >
            {isSubmitting ? 'Creating...' : 'Create Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}

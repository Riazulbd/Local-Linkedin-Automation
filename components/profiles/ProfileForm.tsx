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
  const [email, setEmail] = useState('');
  const [adspowerId, setAdspowerId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !adspowerId.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          linkedin_email: email.trim() || undefined,
          adspower_profile_id: adspowerId.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create profile');
      }

      await refreshProfiles();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-border bg-bg-surface p-6 shadow-2xl"
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
              onChange={(e) => setName(e.target.value)}
              placeholder="Profile display name"
              required
              className="rounded-md border border-border bg-bg-base px-2.5 py-2 text-xs text-text-primary outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            LinkedIn Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="rounded-md border border-border bg-bg-base px-2.5 py-2 text-xs text-text-primary outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            AdsPower Profile ID *
            <input
              value={adspowerId}
              onChange={(e) => setAdspowerId(e.target.value)}
              placeholder="AdsPower browser profile ID"
              required
              className="rounded-md border border-border bg-bg-base px-2.5 py-2 text-xs text-text-primary outline-none focus:border-accent"
            />
          </label>
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
            disabled={isSubmitting || !name.trim() || !adspowerId.trim()}
            className="rounded-md bg-accent px-4 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50 transition"
          >
            {isSubmitting ? 'Creating...' : 'Create Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}

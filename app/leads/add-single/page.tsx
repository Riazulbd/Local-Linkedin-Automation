'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProfileStore } from '@/store/profileStore';
import type { LeadFolder } from '@/types';

export default function AddSingleLeadPage() {
  const router = useRouter();
  const profiles = useProfileStore((state) => state.profiles);
  const selectedProfile = useProfileStore((state) => state.selectedProfile);
  const selectProfileById = useProfileStore((state) => state.selectProfileById);

  const [folders, setFolders] = useState<LeadFolder[]>([]);
  const [folderId, setFolderId] = useState('');
  const [url, setUrl] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/lead-folders', { cache: 'no-store' })
      .then((res) => res.json().catch(() => ({})))
      .then((payload) => setFolders((payload.folders ?? []) as LeadFolder[]))
      .catch(() => setFolders([]));
  }, []);

  async function saveLead() {
    if (!selectedProfile?.id) {
      setError('Select a profile first.');
      return;
    }

    if (!url.includes('linkedin.com/in/')) {
      setError('Enter a valid LinkedIn profile URL.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: selectedProfile.id,
          folder_id: folderId || undefined,
          linkedin_url: url.trim(),
          first_name: firstName.trim() || undefined,
          last_name: lastName.trim() || undefined,
          company: company.trim() || undefined,
          title: title.trim() || undefined,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to add lead');
      }

      router.push('/leads');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to add lead');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/leads" className="text-xs text-slate-500 hover:text-slate-700">
            Back to leads
          </Link>
          <h1 className="text-xl font-semibold text-slate-900">Add Single Lead</h1>
          <p className="text-sm text-slate-500">Create one lead manually for quick testing.</p>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <label className="block text-xs text-slate-600">
          Profile
          <select
            value={selectedProfile?.id || ''}
            onChange={(event) => selectProfileById(event.target.value || null)}
            className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-900"
          >
            <option value="">Select profile</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-slate-600">
          Folder (optional)
          <select
            value={folderId}
            onChange={(event) => setFolderId(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-900"
          >
            <option value="">No folder</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-slate-600">
          LinkedIn URL *
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.linkedin.com/in/username/"
            className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-900"
          />
          <span className="mt-1 block text-[11px] text-slate-500">
            You can leave other fields blank and auto-scrape them on first visit.
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-slate-600">
            First Name
            <input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="block text-xs text-slate-600">
            Last Name
            <input
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-900"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-slate-600">
            Company
            <input
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="block text-xs text-slate-600">
            Job Title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-900"
            />
          </label>
        </div>
      </div>

      {error && <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => saveLead().catch(() => undefined)}
          disabled={saving || !url.trim()}
          className="rounded-md border border-cyan-400/40 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Add Lead'}
        </button>
      </div>
    </main>
  );
}

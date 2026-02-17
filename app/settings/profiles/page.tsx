'use client';

import { useState } from 'react';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useProfileStore } from '@/store/profileStore';
import { ProfileForm } from '@/components/profiles/ProfileForm';

export default function ProfilesSettingsPage() {
  const profiles = useProfileStore((state) => state.profiles);
  const refreshProfiles = useProfileStore((state) => state.refreshProfiles);
  const isLoading = useProfileStore((state) => state.isLoading);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this profile? All associated leads, workflows, and execution data will be removed.')) return;
    setDeleting(id);
    try {
      await fetch(`/api/profiles/${id}`, { method: 'DELETE' });
      await refreshProfiles();
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-5 md:p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-3">
          <Link href="/settings" className="rounded-lg border border-slate-200 p-1.5 text-text-muted transition hover:text-text-primary">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">LinkedIn Profiles</h1>
            <p className="text-sm text-text-muted">Manage your LinkedIn accounts and AdsPower browser profiles.</p>
          </div>
          <div className="ml-auto">
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Profile
            </button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-text-faint">Loading...</p>
        ) : profiles.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm text-text-faint">No profiles yet. Add your first LinkedIn profile to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {profiles.map((profile) => (
              <div key={profile.id} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: profile.avatar_color }}
                >
                  {profile.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-text-primary">{profile.name}</div>
                  <div className="text-xs text-text-muted">{profile.linkedin_email || profile.adspower_profile_id}</div>
                </div>
                <span className="rounded-full border border-border bg-bg-elevated px-2 py-0.5 text-[10px] font-semibold uppercase text-text-muted">
                  {profile.status}
                </span>
                <Link
                  href={`/settings/profiles/${profile.id}`}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-text-muted transition hover:bg-slate-100 hover:text-text-primary"
                >
                  Edit
                </Link>
                <button
                  onClick={() => handleDelete(profile.id)}
                  disabled={deleting === profile.id}
                  className="rounded-lg border border-slate-200 p-1.5 text-text-faint transition hover:border-red-300 hover:text-red-500 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {showForm && <ProfileForm onClose={() => setShowForm(false)} />}
      </div>
    </div>
  );
}

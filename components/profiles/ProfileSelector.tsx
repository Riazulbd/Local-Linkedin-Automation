'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useProfileStore } from '@/store/profileStore';
import { ProfileRow } from './ProfileRow';
import { ProfileForm } from './ProfileForm';

export function ProfileSelector() {
  const profiles = useProfileStore((state) => state.profiles);
  const selectedProfile = useProfileStore((state) => state.selectedProfile);
  const selectProfile = useProfileStore((state) => state.selectProfile);
  const isLoading = useProfileStore((state) => state.isLoading);
  const [showForm, setShowForm] = useState(false);

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-bg-surface">
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">Profiles</h2>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-elevated px-2 py-1 text-[11px] text-text-primary transition hover:bg-bg-base"
        >
          <Plus className="h-3 w-3" />
          Add
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          <p className="px-2 py-4 text-center text-xs text-text-faint">Loading profiles...</p>
        ) : profiles.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-text-faint">No profiles yet. Add one to begin.</p>
        ) : (
          profiles.map((profile) => (
            <ProfileRow
              key={profile.id}
              profile={profile}
              isSelected={selectedProfile?.id === profile.id}
              onClick={() => selectProfile(profile)}
            />
          ))
        )}
      </div>

      {showForm && <ProfileForm onClose={() => setShowForm(false)} />}
    </aside>
  );
}

'use client';

import { BrowserViewport } from '@/components/monitor/BrowserViewport';
import { useProfileStore } from '@/store/profileStore';
import Link from 'next/link';

export default function MonitorPage() {
  const selectedProfile = useProfileStore((state) => state.selectedProfile);

  return (
    <div className="flex h-full flex-col p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-text-primary">Live Browser Monitor</h1>
        <p className="text-sm text-text-muted">
          {selectedProfile
            ? `Watching: ${selectedProfile.name}`
            : 'Select a profile to monitor its browser session.'}
        </p>
      </div>
      {!selectedProfile && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          No profile selected.{' '}
          <Link href="/settings/profiles" className="underline decoration-amber-300/60 underline-offset-2">
            Create or select a profile
          </Link>
          .
        </div>
      )}
      <div className="flex-1 min-h-0">
        <BrowserViewport />
      </div>
    </div>
  );
}

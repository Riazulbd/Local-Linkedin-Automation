'use client';

import type { SyncStatus } from '@/types';

interface UniboxSyncPanelProps {
  status: SyncStatus[];
  syncing?: boolean;
  onSyncAll: () => Promise<void>;
  onSyncProfile: (profileId: string) => Promise<void>;
}

export function UniboxSyncPanel({
  status,
  syncing = false,
  onSyncAll,
  onSyncProfile,
}: UniboxSyncPanelProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Sync Controls</h3>
        <button
          type="button"
          onClick={() => onSyncAll().catch(() => undefined)}
          disabled={syncing}
          className="rounded-md border border-cyan-400/40 px-2.5 py-1 text-xs text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-60"
        >
          {syncing ? 'Syncing...' : 'Sync All Profiles'}
        </button>
      </div>

      <div className="mt-2 space-y-1">
        {status.map((row) => (
          <div key={row.profile_id} className="flex items-center justify-between rounded-md border border-slate-200 px-2 py-1.5">
            <div className="text-xs text-slate-600">
              <span className="font-mono text-[11px] text-slate-700">{row.profile_id.slice(0, 8)}</span>{' '}
              <span>Conversations: {row.conversations_synced}</span>
            </div>
            <button
              type="button"
              onClick={() => onSyncProfile(row.profile_id).catch(() => undefined)}
              className="rounded border border-slate-300 px-2 py-0.5 text-[11px] text-slate-700 hover:bg-slate-100"
            >
              Sync
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

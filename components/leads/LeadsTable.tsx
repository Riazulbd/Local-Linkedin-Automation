'use client';

import { useEffect, useMemo } from 'react';
import { RefreshCcw, CheckSquare, Square } from 'lucide-react';
import Link from 'next/link';
import { LeadsUpload } from './LeadsUpload';
import { LeadStatusBadge } from './LeadStatusBadge';
import { useLeadsStore } from '@/store/leadsStore';
import { useProfileStore } from '@/store/profileStore';

export function LeadsTable() {
  const selectedProfile = useProfileStore((state) => state.selectedProfile);
  const leads = useLeadsStore((state) => state.leads);
  const selectedLeadIds = useLeadsStore((state) => state.selectedLeadIds);
  const isLoading = useLeadsStore((state) => state.isLoading);
  const error = useLeadsStore((state) => state.error);
  const refreshLeads = useLeadsStore((state) => state.refreshLeads);
  const toggleLeadSelection = useLeadsStore((state) => state.toggleLeadSelection);
  const setSelectedLeadIds = useLeadsStore((state) => state.setSelectedLeadIds);

  useEffect(() => {
    refreshLeads().catch(() => undefined);
  }, [refreshLeads]);

  const pendingLeadIds = useMemo(
    () => leads.filter((lead) => lead.status === 'pending').map((lead) => lead.id),
    [leads]
  );

  const allPendingSelected = pendingLeadIds.length > 0 && pendingLeadIds.every((id) => selectedLeadIds.includes(id));

  const toggleSelectAllPending = () => {
    if (allPendingSelected) {
      setSelectedLeadIds(selectedLeadIds.filter((id) => !pendingLeadIds.includes(id)));
      return;
    }

    const merged = new Set([...selectedLeadIds, ...pendingLeadIds]);
    setSelectedLeadIds(Array.from(merged));
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        {!selectedProfile && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            No profile selected.{' '}
            <Link href="/settings/profiles" className="underline decoration-amber-300/60 underline-offset-2">
              Create or select a profile
            </Link>{' '}
            to upload and view leads.
          </div>
        )}

        <LeadsUpload onUploaded={() => refreshLeads()} />

        <section className="rounded-xl border border-border bg-bg-surface p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">Leads</h3>
              <p className="mt-1 text-xs text-text-muted">
                {leads.length} total - {pendingLeadIds.length} pending - {selectedLeadIds.length} selected
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSelectAllPending}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-elevated px-2 py-1.5 text-xs text-text-primary transition hover:bg-bg-base"
              >
                {allPendingSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                {allPendingSelected ? 'Unselect Pending' : 'Select Pending'}
              </button>
              <button
                type="button"
                onClick={() => refreshLeads()}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-elevated px-2 py-1.5 text-xs text-text-primary transition hover:bg-bg-base"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <p className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[880px] table-auto text-left text-xs">
              <thead className="bg-bg-elevated text-text-muted">
                <tr>
                  <th className="px-3 py-2">Select</th>
                  <th className="px-3 py-2">LinkedIn URL</th>
                  <th className="px-3 py-2">First</th>
                  <th className="px-3 py-2">Last</th>
                  <th className="px-3 py-2">Company</th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-t border-border/70 text-text-primary">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.includes(lead.id)}
                        onChange={() => toggleLeadSelection(lead.id)}
                        disabled={lead.status !== 'pending'}
                        className="h-3.5 w-3.5 rounded border-border bg-bg-base"
                      />
                    </td>
                    <td className="max-w-[320px] truncate px-3 py-2">{lead.linkedin_url}</td>
                    <td className="px-3 py-2">{lead.first_name || '-'}</td>
                    <td className="px-3 py-2">{lead.last_name || '-'}</td>
                    <td className="px-3 py-2">{lead.company || '-'}</td>
                    <td className="px-3 py-2">{lead.title || '-'}</td>
                    <td className="px-3 py-2">
                      <LeadStatusBadge status={lead.status} />
                    </td>
                  </tr>
                ))}
                {!isLoading && !leads.length && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-text-faint">
                      No leads found. Upload a CSV to begin.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}



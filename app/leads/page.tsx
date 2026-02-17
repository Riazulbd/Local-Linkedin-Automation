'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { LeadsTable } from '@/components/leads/LeadsTable';
import { useLeadsStore } from '@/store/leadsStore';

export default function LeadsPage() {
  const refreshLeads = useLeadsStore((state) => state.refreshLeads);

  useEffect(() => {
    refreshLeads().catch(() => undefined);
  }, [refreshLeads]);

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Leads</h1>
          <p className="text-sm text-slate-500">Manage imported leads and assignment status.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/leads/folders"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            Lead Folders
          </Link>
          <Link
            href="/leads/import"
            className="rounded-md border border-cyan-400/40 px-3 py-1.5 text-sm text-cyan-200 hover:bg-cyan-500/20"
          >
            CSV Import
          </Link>
        </div>
      </div>

      <LeadsTable />
    </main>
  );
}

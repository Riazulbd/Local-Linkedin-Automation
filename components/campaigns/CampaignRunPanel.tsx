'use client';

import type { CampaignLeadProgress } from '@/types';

interface CampaignRunPanelProps {
  progress: CampaignLeadProgress[];
}

export function CampaignRunPanel({ progress }: CampaignRunPanelProps) {
  const completed = progress.filter((row) => row.status === 'completed').length;
  const failed = progress.filter((row) => row.status === 'failed').length;
  const waiting = progress.filter((row) => row.status === 'waiting').length;
  const pending = progress.filter((row) => row.status === 'pending').length;

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-900">Campaign Run Status</h3>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Pending" value={pending} tone="text-slate-200" />
        <Stat label="Waiting" value={waiting} tone="text-amber-200" />
        <Stat label="Completed" value={completed} tone="text-emerald-200" />
        <Stat label="Failed" value={failed} tone="text-rose-200" />
      </div>

      <div className="mt-4 max-h-64 overflow-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Lead</th>
              <th className="px-3 py-2 font-medium">Step</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Next action</th>
            </tr>
          </thead>
          <tbody>
            {progress.map((row) => (
              <tr key={row.id} className="border-t border-slate-200">
                <td className="px-3 py-2 font-mono text-[11px]">{row.lead_id.slice(0, 8)}</td>
                <td className="px-3 py-2">{row.current_step + 1}</td>
                <td className="px-3 py-2">{row.status}</td>
                <td className="px-3 py-2">{row.next_action_at ? new Date(row.next_action_at).toLocaleString() : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

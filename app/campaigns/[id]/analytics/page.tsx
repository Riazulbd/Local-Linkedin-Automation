'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import type { CampaignLeadProgress } from '@/types';

export default function CampaignAnalyticsPage() {
  const params = useParams<{ id: string }>();
  const campaignId = String(params?.id || '');

  const [progress, setProgress] = useState<CampaignLeadProgress[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!campaignId) return;
    let mounted = true;

    async function fetchData() {
      try {
        const response = await fetch(`/api/campaigns/${campaignId}`, { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Failed to load analytics');
        if (!mounted) return;
        setProgress((payload.progress ?? []) as CampaignLeadProgress[]);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      }
    }

    fetchData().catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [campaignId]);

  const metrics = useMemo(() => {
    const total = progress.length;
    const completed = progress.filter((row) => row.status === 'completed').length;
    const failed = progress.filter((row) => row.status === 'failed').length;
    const waiting = progress.filter((row) => row.status === 'waiting').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, failed, waiting, completionRate };
  }, [progress]);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      <h1 className="text-xl font-semibold text-white">Campaign Analytics</h1>
      {error && <p className="text-sm text-rose-300">{error}</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <MetricCard label="Total Leads" value={metrics.total} />
        <MetricCard label="Completed" value={metrics.completed} />
        <MetricCard label="Failed" value={metrics.failed} />
        <MetricCard label="Waiting" value={metrics.waiting} />
        <MetricCard label="Completion %" value={metrics.completionRate} />
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-sm font-semibold text-white">Recent Step Results</h2>
        <div className="mt-2 max-h-72 overflow-auto rounded-md border border-white/10">
          <table className="min-w-full text-left text-xs text-white/70">
            <thead className="bg-white/5 text-white/50">
              <tr>
                <th className="px-3 py-2">Lead</th>
                <th className="px-3 py-2">Step</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Last action</th>
              </tr>
            </thead>
            <tbody>
              {progress.map((row) => (
                <tr key={row.id} className="border-t border-white/5">
                  <td className="px-3 py-2 font-mono text-[11px]">{row.lead_id.slice(0, 8)}</td>
                  <td className="px-3 py-2">{row.current_step + 1}</td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="px-3 py-2">{row.last_action_at ? new Date(row.last_action_at).toLocaleString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <p className="text-[11px] uppercase tracking-wide text-white/50">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

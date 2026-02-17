'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useSettingsStore } from '@/store/settingsStore';

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-text-muted">
      {label}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-text-primary outline-none transition focus:border-blue-300"
      />
    </label>
  );
}

export default function DefaultsSettingsPage() {
  const limits = useSettingsStore((state) => state.limits);
  const updateLimits = useSettingsStore((state) => state.updateLimits);
  const isLoading = useSettingsStore((state) => state.isLoading);

  if (isLoading) return <div className="p-6 text-sm text-text-faint">Loading settings...</div>;

  return (
    <div className="h-full overflow-y-auto p-5 md:p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <Link href="/settings" className="rounded-lg border border-slate-200 p-1.5 text-text-muted transition hover:text-text-primary">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Default Limits</h1>
            <p className="text-sm text-text-muted">Configure daily action limits and timing delays.</p>
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Daily Action Limits</h3>
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Profile Visits" value={limits.dailyVisitLimit} onChange={(v) => updateLimits({ dailyVisitLimit: v })} />
              <NumberField label="Connection Requests" value={limits.dailyConnectLimit} onChange={(v) => updateLimits({ dailyConnectLimit: v })} />
              <NumberField label="Messages" value={limits.dailyMessageLimit} onChange={(v) => updateLimits({ dailyMessageLimit: v })} />
              <NumberField label="Follows" value={limits.dailyFollowLimit} onChange={(v) => updateLimits({ dailyFollowLimit: v })} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Action Delays (seconds)</h3>
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Min Action Delay" value={limits.minActionDelaySec} onChange={(v) => updateLimits({ minActionDelaySec: v })} />
              <NumberField label="Max Action Delay" value={limits.maxActionDelaySec} onChange={(v) => updateLimits({ maxActionDelaySec: v })} />
              <NumberField label="Min Lead Delay" value={limits.minLeadDelaySec} onChange={(v) => updateLimits({ minLeadDelaySec: v })} />
              <NumberField label="Max Lead Delay" value={limits.maxLeadDelaySec} onChange={(v) => updateLimits({ maxLeadDelaySec: v })} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

'use client';

import type { Campaign } from '@/types';
import { CampaignStatusBadge } from './CampaignStatusBadge';

interface CampaignCardProps {
  campaign: Campaign;
  selected?: boolean;
  onSelect?: (campaignId: string) => void;
  onStart?: (campaignId: string) => void;
  onStop?: (campaignId: string) => void;
  onDelete?: (campaignId: string) => void;
}

export function CampaignCard({
  campaign,
  selected = false,
  onSelect,
  onStart,
  onStop,
  onDelete,
}: CampaignCardProps) {
  const steps = campaign.steps ?? campaign.sequence ?? [];
  const profiles = campaign.profiles ?? campaign.profile_ids ?? [];
  const progress = campaign.total_leads > 0
    ? Math.min(100, Math.round((campaign.contacted_leads / campaign.total_leads) * 100))
    : 0;

  return (
    <article
      data-hover="lift"
      className={`rounded-xl border p-4 transition ${
        selected
          ? 'border-cyan-400/50 bg-cyan-500/10'
          : 'border-slate-200 bg-slate-50 hover:border-slate-300'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{campaign.name}</h3>
          <p className="mt-1 text-xs text-slate-500">{campaign.description || 'No description'}</p>
        </div>
        <CampaignStatusBadge status={campaign.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
        <span>Profiles: {profiles.length}</span>
        <span>Steps: {steps.length}</span>
        <span>Leads: {campaign.total_leads}</span>
        <span>Daily cap: {campaign.daily_new_leads}</span>
      </div>

      <div className="mt-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-cyan-400/80" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-1 text-[10px] text-slate-500">{progress}% contacted</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSelect?.(campaign.id)}
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100"
        >
          Open
        </button>
        <button
          type="button"
          onClick={() => onStart?.(campaign.id)}
          className="rounded-lg border border-emerald-500/40 px-2.5 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20"
        >
          Start
        </button>
        <button
          type="button"
          onClick={() => onStop?.(campaign.id)}
          className="rounded-lg border border-amber-500/40 px-2.5 py-1 text-xs text-amber-200 hover:bg-amber-500/20"
        >
          Pause
        </button>
        <button
          type="button"
          onClick={() => onDelete?.(campaign.id)}
          className="rounded-lg border border-rose-500/40 px-2.5 py-1 text-xs text-rose-200 hover:bg-rose-500/20"
        >
          Delete
        </button>
      </div>
    </article>
  );
}

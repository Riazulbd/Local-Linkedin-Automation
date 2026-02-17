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
  return (
    <article
      className={`rounded-xl border p-4 transition ${
        selected
          ? 'border-cyan-400/50 bg-cyan-500/10'
          : 'border-white/10 bg-white/5 hover:border-white/20'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">{campaign.name}</h3>
          <p className="mt-1 text-xs text-white/60">{campaign.description || 'No description'}</p>
        </div>
        <CampaignStatusBadge status={campaign.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/60">
        <span>Steps: {Array.isArray(campaign.sequence) ? campaign.sequence.length : 0}</span>
        <span>Daily cap: {campaign.daily_new_leads}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSelect?.(campaign.id)}
          className="rounded-lg border border-white/15 px-2.5 py-1 text-xs text-white/80 hover:bg-white/10"
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

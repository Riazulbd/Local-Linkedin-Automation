'use client';

import type { CampaignStatus } from '@/types';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<CampaignStatus, string> = {
  draft: 'border-slate-500/40 bg-slate-500/10 text-slate-200',
  active: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  paused: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  completed: 'border-blue-500/40 bg-blue-500/10 text-blue-200',
  archived: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300',
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        STATUS_STYLES[status]
      )}
    >
      {status}
    </span>
  );
}

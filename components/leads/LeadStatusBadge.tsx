'use client';

import { cn } from '@/lib/utils';
import type { Lead } from '@/types';

const STATUS_STYLE: Record<Lead['status'], string> = {
  pending: 'bg-slate-500/20 text-slate-200 border-slate-500/50',
  running: 'bg-blue-500/20 text-blue-200 border-blue-500/50',
  completed: 'bg-green-500/20 text-green-200 border-green-500/50',
  failed: 'bg-red-500/20 text-red-200 border-red-500/50',
  skipped: 'bg-yellow-500/20 text-yellow-200 border-yellow-500/50',
};

export function LeadStatusBadge({ status }: { status: Lead['status'] }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        STATUS_STYLE[status]
      )}
    >
      {status}
    </span>
  );
}

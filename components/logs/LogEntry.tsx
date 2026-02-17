'use client';

import { cn } from '@/lib/utils';
import type { ExecutionLog } from '@/types';

interface LogEntryProps {
  log: ExecutionLog & { leadName?: string };
  onClick?: () => void;
}

const STATUS_ROW_CLASS: Record<ExecutionLog['status'], string> = {
  running: 'border-l-blue-400/70 bg-blue-500/5',
  success: 'border-l-green-400/70 bg-green-500/5',
  error: 'border-l-red-400/70 bg-red-500/5',
  skipped: 'border-l-yellow-400/70 bg-yellow-500/5',
};

const STATUS_TEXT_CLASS: Record<ExecutionLog['status'], string> = {
  running: 'text-blue-300',
  success: 'text-green-300',
  error: 'text-red-300',
  skipped: 'text-yellow-300',
};

export function LogEntry({ log, onClick }: LogEntryProps) {
  const time = new Date(log.created_at).toLocaleTimeString();

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full border-l-2 border-transparent px-3 py-2 text-left transition hover:bg-bg-base/80',
        STATUS_ROW_CLASS[log.status]
      )}
    >
      <div className="flex items-center justify-between gap-2 text-[11px] text-text-muted">
        <span className="mono">{time}</span>
        <span className={cn('font-semibold uppercase tracking-wide', STATUS_TEXT_CLASS[log.status])}>{log.status}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="font-medium text-text-primary">{log.leadName || 'Unknown Lead'}</span>
        <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-text-faint">
          {log.node_type}
        </span>
        <span className="text-text-muted">{log.message || '-'}</span>
      </div>
    </button>
  );
}

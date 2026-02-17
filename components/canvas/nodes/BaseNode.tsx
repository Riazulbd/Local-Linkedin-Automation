'use client';

import { Handle, Position } from 'reactflow';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { NodeExecutionStatus } from '@/store/workflowStore';

interface BaseNodeProps {
  title: string;
  icon: ReactNode;
  description: string;
  status?: NodeExecutionStatus;
  highlighted?: boolean;
  showTarget?: boolean;
  showSource?: boolean;
  children?: ReactNode;
}

const STATUS_CLASS: Record<NodeExecutionStatus, string> = {
  running: 'ring-2 ring-blue-400 animate-pulse',
  success: 'ring-2 ring-green-400',
  error: 'ring-2 ring-red-400',
  skipped: 'ring-2 ring-yellow-400',
};

export function BaseNode({
  title,
  icon,
  description,
  status,
  highlighted,
  showTarget = true,
  showSource = true,
  children,
}: BaseNodeProps) {
  return (
    <div
      className={cn(
        'w-56 rounded-xl border border-border bg-bg-surface px-3 py-2 shadow-md transition-all',
        status ? STATUS_CLASS[status] : 'ring-0',
        highlighted && 'outline outline-2 outline-accent outline-offset-2'
      )}
    >
      {showTarget && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-2.5 !w-2.5 !border !border-bg-surface !bg-accent"
        />
      )}

      {showSource && (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-2.5 !w-2.5 !border !border-bg-surface !bg-accent"
        />
      )}

      <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
        <span className="text-accent">{icon}</span>
        <span>{title}</span>
      </div>
      <p className="mt-1 text-[11px] leading-4 text-text-muted">{description}</p>
      {children}
    </div>
  );
}

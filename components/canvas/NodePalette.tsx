'use client';

import type { ComponentType, DragEvent } from 'react';
import {
  Eye,
  MessageSquare,
  UserPlus,
  Handshake,
  Timer,
  SearchCheck,
  GitBranchPlus,
  RefreshCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NodeType } from '@/types';

const NODE_OPTIONS: Array<{
  type: NodeType;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { type: 'visit_profile', label: 'Visit Profile', icon: Eye },
  { type: 'send_message', label: 'Send Message', icon: MessageSquare },
  { type: 'follow_profile', label: 'Follow Profile', icon: UserPlus },
  { type: 'send_connection', label: 'Send Connection', icon: Handshake },
  { type: 'wait_delay', label: 'Wait Delay', icon: Timer },
  { type: 'check_connection', label: 'Check Connection', icon: SearchCheck },
  { type: 'if_condition', label: 'If Condition', icon: GitBranchPlus },
  { type: 'loop_leads', label: 'Loop Leads', icon: RefreshCcw },
];

export function NodePalette() {
  const onDragStart = (event: DragEvent<HTMLButtonElement>, nodeType: NodeType) => {
    event.dataTransfer.setData('application/x-node-type', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="h-full overflow-y-auto border-r border-border bg-bg-surface p-3">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">Node Palette</h2>
      <div className="space-y-2">
        {NODE_OPTIONS.map((node) => {
          const Icon = node.icon;
          return (
            <button
              key={node.type}
              type="button"
              draggable
              onDragStart={(event) => onDragStart(event, node.type)}
              className={cn(
                'group flex w-full items-center gap-2 rounded-md border border-border bg-bg-elevated px-2.5 py-2 text-left text-xs transition',
                'hover:border-accent/50 hover:bg-bg-base'
              )}
            >
              <Icon className="h-3.5 w-3.5 text-accent" />
              <span className="text-text-primary">{node.label}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-[11px] leading-4 text-text-faint">Drag nodes to the canvas and connect outputs to inputs.</p>
    </aside>
  );
}

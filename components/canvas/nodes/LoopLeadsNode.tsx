'use client';

import { RefreshCcw } from 'lucide-react';
import type { NodeProps } from 'reactflow';
import { BaseNode } from './BaseNode';
import type { NodeData } from '@/types';

interface LoopNodeData extends NodeData {
  status?: 'running' | 'success' | 'error' | 'skipped';
  highlighted?: boolean;
}

export function LoopLeadsNode({ data }: NodeProps<LoopNodeData>) {
  return (
    <BaseNode
      title="Loop Leads"
      icon={<RefreshCcw size={14} />}
      description="Entry point: iterates all selected leads"
      status={data.status}
      highlighted={data.highlighted}
      showTarget={false}
    />
  );
}

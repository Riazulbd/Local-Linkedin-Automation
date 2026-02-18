'use client';

import { Timer } from 'lucide-react';
import type { NodeProps } from 'reactflow';
import { BaseNode } from './BaseNode';
import type { NodeData } from '@/types';

interface WaitNodeData extends NodeData {
  status?: 'running' | 'success' | 'error' | 'skipped';
  highlighted?: boolean;
}

export function WaitDelayNode({ data }: NodeProps<WaitNodeData>) {
  const text = data.useRandomRange
    ? `${data.minSeconds ?? 3}s - ${data.maxSeconds ?? 10}s random`
    : `${data.seconds ?? 5}s fixed`;

  return (
    <BaseNode
      title="Wait Delay"
      icon={<Timer size={14} />}
      description={text}
      status={data.status}
      highlighted={data.highlighted}
    />
  );
}

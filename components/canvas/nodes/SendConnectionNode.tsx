'use client';

import { Handshake } from 'lucide-react';
import type { NodeProps } from 'reactflow';
import { BaseNode } from './BaseNode';
import type { NodeData } from '@/types';

interface SendConnectionNodeData extends NodeData {
  status?: 'running' | 'success' | 'error' | 'skipped';
  highlighted?: boolean;
}

export function SendConnectionNode({ data }: NodeProps<SendConnectionNodeData>) {
  return (
    <BaseNode
      title="Send Connection"
      icon={<Handshake size={14} />}
      description={data.connectionNote ? 'Uses invitation note' : 'Sends without note'}
      status={data.status}
      highlighted={data.highlighted}
    />
  );
}

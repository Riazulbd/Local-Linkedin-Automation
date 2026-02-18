'use client';

import { SearchCheck } from 'lucide-react';
import type { NodeProps } from 'reactflow';
import { BaseNode } from './BaseNode';
import type { NodeData } from '@/types';

interface CheckNodeData extends NodeData {
  status?: 'running' | 'success' | 'error' | 'skipped';
  highlighted?: boolean;
}

export function CheckConnectionNode({ data }: NodeProps<CheckNodeData>) {
  return (
    <BaseNode
      title="Check Connection"
      icon={<SearchCheck size={14} />}
      description="Checks connected / following / pending state"
      status={data.status}
      highlighted={data.highlighted}
    />
  );
}

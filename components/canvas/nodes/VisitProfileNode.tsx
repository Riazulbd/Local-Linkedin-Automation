'use client';

import { Eye } from 'lucide-react';
import type { NodeProps } from 'reactflow';
import { BaseNode } from './BaseNode';
import type { NodeData } from '@/types';

interface VisitNodeData extends NodeData {
  status?: 'running' | 'success' | 'error' | 'skipped';
  highlighted?: boolean;
}

export function VisitProfileNode({ data }: NodeProps<VisitNodeData>) {
  return (
    <BaseNode
      title="Visit Profile"
      icon={<Eye size={14} />}
      description={data.useCurrentLead ? 'Uses current lead URL' : data.url || 'Opens manual profile URL'}
      status={data.status}
      highlighted={data.highlighted}
    />
  );
}

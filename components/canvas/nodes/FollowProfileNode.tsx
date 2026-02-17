'use client';

import { UserPlus } from 'lucide-react';
import type { NodeProps } from 'reactflow';
import { BaseNode } from './BaseNode';
import type { NodeData } from '@/types';

interface FollowNodeData extends NodeData {
  status?: 'running' | 'success' | 'error' | 'skipped';
  highlighted?: boolean;
}

export function FollowProfileNode({ data }: NodeProps<FollowNodeData>) {
  return (
    <BaseNode
      title="Follow Profile"
      icon={<UserPlus className="h-3.5 w-3.5" />}
      description={data.fallbackToConnect === false ? 'Follow only' : 'Falls back to connect'}
      status={data.status}
      highlighted={data.highlighted}
    />
  );
}

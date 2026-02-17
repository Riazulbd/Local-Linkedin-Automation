'use client';

import { GitBranchPlus } from 'lucide-react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { BaseNode } from './BaseNode';
import type { NodeData } from '@/types';

interface IfNodeData extends NodeData {
  status?: 'running' | 'success' | 'error' | 'skipped';
  highlighted?: boolean;
}

export function IfConditionNode({ data }: NodeProps<IfNodeData>) {
  return (
    <BaseNode
      title="If Condition"
      icon={<GitBranchPlus className="h-3.5 w-3.5" />}
      description={data.condition || 'Uses default condition'}
      status={data.status}
      highlighted={data.highlighted}
      showSource={false}
    >
      <Handle
        id="yes"
        type="source"
        position={Position.Right}
        style={{ top: '38%' }}
        className="!h-2.5 !w-2.5 !border !border-bg-surface !bg-green-500"
      />
      <Handle
        id="no"
        type="source"
        position={Position.Right}
        style={{ top: '70%' }}
        className="!h-2.5 !w-2.5 !border !border-bg-surface !bg-red-500"
      />
      <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-wide text-text-faint">
        <span>yes</span>
        <span>no</span>
      </div>
    </BaseNode>
  );
}

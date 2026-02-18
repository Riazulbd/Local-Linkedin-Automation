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
      icon={<GitBranchPlus size={14} />}
      description={data.condition || 'Uses default condition'}
      status={data.status}
      highlighted={data.highlighted}
      showSource={false}
    >
      <Handle
        id="yes"
        type="source"
        position={Position.Right}
        style={{ top: '38%', width: 10, height: 10, border: '1px solid #1e293b', background: '#34d399' }}
      />
      <Handle
        id="no"
        type="source"
        position={Position.Right}
        style={{ top: '70%', width: 10, height: 10, border: '1px solid #1e293b', background: '#f87171' }}
      />
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, color: '#94a3b8' }}>
        <span>yes</span>
        <span>no</span>
      </div>
    </BaseNode>
  );
}

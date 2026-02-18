'use client';

import { Handle, Position } from 'reactflow';
import type { ReactNode } from 'react';
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

const STATUS_BORDER: Record<NodeExecutionStatus, string> = {
  running: '#60a5fa',
  success: '#34d399',
  error: '#f87171',
  skipped: '#fbbf24',
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
      style={{
        width: 236,
        borderRadius: 12,
        border: `1px solid ${status ? STATUS_BORDER[status] : '#475569'}`,
        background: '#1e293b',
        color: '#f1f5f9',
        boxShadow: highlighted ? '0 0 0 2px #818cf8' : '0 8px 16px rgba(2,6,23,0.28)',
        padding: '10px 12px',
        transition: 'all 0.2s ease',
      }}
    >
      {showTarget && (
        <Handle
          type="target"
          position={Position.Left}
          style={{
            width: 10,
            height: 10,
            border: '1px solid #1e293b',
            background: '#6366f1',
          }}
        />
      )}

      {showSource && (
        <Handle
          type="source"
          position={Position.Right}
          style={{
            width: 10,
            height: 10,
            border: '1px solid #1e293b',
            background: '#6366f1',
          }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700 }}>
        <span style={{ color: '#a5b4fc', display: 'inline-flex' }}>{icon}</span>
        <span>{title}</span>
      </div>
      <p style={{ marginTop: 6, fontSize: 11, lineHeight: '15px', color: '#94a3b8' }}>{description}</p>
      {children}
    </div>
  );
}

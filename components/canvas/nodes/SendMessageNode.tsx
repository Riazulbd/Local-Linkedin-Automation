'use client';

import { MessageSquare } from 'lucide-react';
import type { NodeProps } from 'reactflow';
import { BaseNode } from './BaseNode';
import type { NodeData } from '@/types';

interface SendMessageNodeData extends NodeData {
  status?: 'running' | 'success' | 'error' | 'skipped';
  highlighted?: boolean;
}

export function SendMessageNode({ data }: NodeProps<SendMessageNodeData>) {
  return (
    <BaseNode
      title="Send Message"
      icon={<MessageSquare className="h-3.5 w-3.5" />}
      description={data.messageTemplate ? 'Template configured' : 'No template set'}
      status={data.status}
      highlighted={data.highlighted}
    />
  );
}

export type NodeType =
  | 'loop_leads'
  | 'visit_profile'
  | 'follow_profile'
  | 'send_connection'
  | 'send_message'
  | 'check_connection'
  | 'wait_delay'
  | 'if_condition';

export interface NodeData {
  label?: string;
  useCurrentLead?: boolean;
  url?: string;
  messageTemplate?: string;
  connectionNote?: string;
  fallbackToConnect?: boolean;
  seconds?: number;
  minSeconds?: number;
  maxSeconds?: number;
  useRandomRange?: boolean;
  condition?: string;
  conditionValue?: string;
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: NodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  label?: string;
}

export interface Workflow {
  id: string;
  profile_id: string;
  name: string;
  description: string | null;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkflowInput {
  profile_id: string;
  name: string;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
}

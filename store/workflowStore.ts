import { create } from 'zustand';

export type NodeExecutionStatus = 'running' | 'success' | 'error' | 'skipped';

interface WorkflowState {
  workflowId: string | null;
  workflowName: string;
  selectedNodeId: string | null;
  highlightedNodeId: string | null;
  nodeStatusMap: Record<string, NodeExecutionStatus | undefined>;
  setWorkflowMeta: (id: string | null, name: string) => void;
  setSelectedNodeId: (id: string | null) => void;
  setHighlightedNodeId: (id: string | null) => void;
  setNodeStatus: (nodeId: string, status: NodeExecutionStatus) => void;
  clearNodeStatuses: () => void;
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  workflowId: null,
  workflowName: 'Untitled Workflow',
  selectedNodeId: null,
  highlightedNodeId: null,
  nodeStatusMap: {},

  setWorkflowMeta: (id, name) => set({ workflowId: id, workflowName: name }),

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  setHighlightedNodeId: (id) => set({ highlightedNodeId: id }),

  setNodeStatus: (nodeId, status) =>
    set((state) => ({
      nodeStatusMap: {
        ...state.nodeStatusMap,
        [nodeId]: status,
      },
    })),

  clearNodeStatuses: () => set({ nodeStatusMap: {} }),
}));

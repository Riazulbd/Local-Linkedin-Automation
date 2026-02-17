'use client';

import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Save, Plus } from 'lucide-react';
import Link from 'next/link';
import { NodePalette } from './NodePalette';
import { NodeConfigPanel } from './NodeConfigPanel';
import { VisitProfileNode } from './nodes/VisitProfileNode';
import { SendMessageNode } from './nodes/SendMessageNode';
import { FollowProfileNode } from './nodes/FollowProfileNode';
import { SendConnectionNode } from './nodes/SendConnectionNode';
import { WaitDelayNode } from './nodes/WaitDelayNode';
import { CheckConnectionNode } from './nodes/CheckConnectionNode';
import { IfConditionNode } from './nodes/IfConditionNode';
import { LoopLeadsNode } from './nodes/LoopLeadsNode';
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useWorkflowStore } from '@/store/workflowStore';
import { useExecutionStore } from '@/store/executionStore';
import { useProfileStore } from '@/store/profileStore';
import type { NodeData, NodeType } from '@/types';

type CanvasNodeData = NodeData & {
  status?: 'running' | 'success' | 'error' | 'skipped';
  highlighted?: boolean;
};

type CanvasNode = Node<CanvasNodeData>;

interface WorkflowRecord {
  id: string;
  name: string;
  description: string | null;
  nodes: CanvasNode[];
  edges: Edge[];
}

const nodeTypes = {
  visit_profile: VisitProfileNode,
  send_message: SendMessageNode,
  follow_profile: FollowProfileNode,
  send_connection: SendConnectionNode,
  wait_delay: WaitDelayNode,
  check_connection: CheckConnectionNode,
  if_condition: IfConditionNode,
  loop_leads: LoopLeadsNode,
};

const NODE_LABELS: Record<NodeType, string> = {
  visit_profile: 'Visit Profile',
  send_message: 'Send Message',
  follow_profile: 'Follow Profile',
  send_connection: 'Send Connection',
  wait_delay: 'Wait Delay',
  check_connection: 'Check Connection',
  if_condition: 'If Condition',
  loop_leads: 'Loop Leads',
};

function defaultNodeData(type: NodeType): NodeData {
  switch (type) {
    case 'visit_profile':
      return { label: NODE_LABELS[type], useCurrentLead: true };
    case 'send_message':
      return { label: NODE_LABELS[type], messageTemplate: 'Hi {{firstName}}, great to connect with you.' };
    case 'follow_profile':
      return { label: NODE_LABELS[type], fallbackToConnect: true };
    case 'send_connection':
      return { label: NODE_LABELS[type], connectionNote: '' };
    case 'wait_delay':
      return { label: NODE_LABELS[type], seconds: 5, useRandomRange: false };
    case 'check_connection':
      return { label: NODE_LABELS[type] };
    case 'if_condition':
      return { label: NODE_LABELS[type], condition: 'connection_status', conditionValue: 'connected' };
    case 'loop_leads':
      return { label: NODE_LABELS[type] };
    default:
      return { label: NODE_LABELS[type] };
  }
}

function initialWorkflowNodes(): CanvasNode[] {
  return [
    {
      id: crypto.randomUUID(),
      type: 'loop_leads',
      position: { x: 80, y: 200 },
      data: defaultNodeData('loop_leads'),
    },
    {
      id: crypto.randomUUID(),
      type: 'visit_profile',
      position: { x: 380, y: 200 },
      data: defaultNodeData('visit_profile'),
    },
  ];
}

function normalizeNodes(rawNodes: unknown): CanvasNode[] {
  if (!Array.isArray(rawNodes)) return [];

  return rawNodes
    .filter((entry): entry is Partial<CanvasNode> => typeof entry === 'object' && entry !== null)
    .map((entry) => {
      const type = (entry.type as NodeType) ?? 'visit_profile';
      return {
        id: typeof entry.id === 'string' ? entry.id : crypto.randomUUID(),
        type,
        position:
          entry.position && typeof entry.position.x === 'number' && typeof entry.position.y === 'number'
            ? entry.position
            : { x: 120, y: 120 },
        data: {
          ...defaultNodeData(type),
          ...(entry.data as NodeData | undefined),
        },
      };
    });
}

function normalizeEdges(rawEdges: unknown): Edge[] {
  if (!Array.isArray(rawEdges)) return [];

  return rawEdges
    .filter((entry): entry is Partial<Edge> => typeof entry === 'object' && entry !== null)
    .map((entry) => ({
      id: typeof entry.id === 'string' ? entry.id : crypto.randomUUID(),
      source: typeof entry.source === 'string' ? entry.source : '',
      target: typeof entry.target === 'string' ? entry.target : '',
      sourceHandle: typeof entry.sourceHandle === 'string' ? entry.sourceHandle : undefined,
      label: typeof entry.label === 'string' ? entry.label : undefined,
      markerEnd: {
        type: MarkerType.ArrowClosed,
      },
      animated: Boolean(entry.animated),
    }))
    .filter((edge) => edge.source && edge.target);
}

function WorkflowCanvasInner() {
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([]);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState('Untitled Workflow');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const flowWrapperRef = useRef<HTMLDivElement | null>(null);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance<CanvasNodeData, Edge> | null>(null);

  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId);
  const setSelectedNodeId = useWorkflowStore((state) => state.setSelectedNodeId);
  const highlightedNodeId = useWorkflowStore((state) => state.highlightedNodeId);
  const nodeStatusMap = useWorkflowStore((state) => state.nodeStatusMap);
  const setNodeStatus = useWorkflowStore((state) => state.setNodeStatus);
  const setWorkflowMeta = useWorkflowStore((state) => state.setWorkflowMeta);
  const clearNodeStatuses = useWorkflowStore((state) => state.clearNodeStatuses);
  const selectedProfile = useProfileStore((state) => state.selectedProfile);
  const selectedProfileId = selectedProfile?.id ?? null;
  const profileLoadError = useProfileStore((state) => state.error);

  const currentRunId = useExecutionStore((state) => state.currentRunId);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );

  useEffect(() => {
    if (!selectedProfileId) {
      setWorkflows([]);
      setActiveWorkflowId(null);
      setWorkflowName('Untitled Workflow');
      setNodes([]);
      setEdges([]);
      setSelectedNodeId(null);
      clearNodeStatuses();
      setWorkflowMeta(null, 'Untitled Workflow');
      setIsLoading(false);
      return;
    }

    const loadWorkflows = async () => {
      setIsLoading(true);
      const response = await fetch(`/api/workflows?profileId=${encodeURIComponent(selectedProfileId)}`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        setIsLoading(false);
        return;
      }

      const payload = await response.json();
      let records: WorkflowRecord[] = (payload.workflows ?? []).map((workflow: WorkflowRecord) => ({
        ...workflow,
        nodes: normalizeNodes(workflow.nodes),
        edges: normalizeEdges(workflow.edges),
      }));

      if (!records.length) {
        const starterNodes = initialWorkflowNodes();
        const starterEdges: Edge[] = [
          {
            id: crypto.randomUUID(),
            source: starterNodes[0].id,
            target: starterNodes[1].id,
            markerEnd: { type: MarkerType.ArrowClosed },
          },
        ];

        const createResponse = await fetch('/api/workflows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Default Outreach Workflow',
            description: 'Starter workflow for LinkedIn outreach.',
            profile_id: selectedProfileId,
            nodes: starterNodes,
            edges: starterEdges,
          }),
        });

        if (createResponse.ok) {
          const created = await createResponse.json();
          records = [
            {
              ...created.workflow,
              nodes: normalizeNodes(created.workflow.nodes),
              edges: normalizeEdges(created.workflow.edges),
            },
          ];
        }
      }

      if (records.length) {
        const first = records[0];
        setWorkflows(records);
        setActiveWorkflowId(first.id);
        setWorkflowName(first.name);
        setNodes(first.nodes);
        setEdges(first.edges);
        setWorkflowMeta(first.id, first.name);
      } else {
        setWorkflows([]);
        setActiveWorkflowId(null);
        setWorkflowName('Untitled Workflow');
        setNodes([]);
        setEdges([]);
        setSelectedNodeId(null);
        setWorkflowMeta(null, 'Untitled Workflow');
      }

      setIsLoading(false);
    };

    loadWorkflows().catch(() => {
      setIsLoading(false);
    });
  }, [
    clearNodeStatuses,
    selectedProfileId,
    setEdges,
    setNodes,
    setSelectedNodeId,
    setWorkflowMeta,
  ]);

  useEffect(() => {
    setNodes((previous) =>
      previous.map((node) => ({
        ...node,
        data: {
          ...node.data,
          status: nodeStatusMap[node.id],
          highlighted: highlightedNodeId === node.id,
        },
      }))
    );
  }, [highlightedNodeId, nodeStatusMap, setNodes]);

  useEffect(() => {
    if (!currentRunId) return;

    clearNodeStatuses();

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`canvas-execution-${currentRunId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'execution_logs',
          filter: `run_id=eq.${currentRunId}`,
        },
        (payload) => {
          const log = payload.new as {
            node_id: string;
            status: 'running' | 'success' | 'error' | 'skipped';
          };

          if (log.node_id) {
            setNodeStatus(log.node_id, log.status);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(() => undefined);
    };
  }, [clearNodeStatuses, currentRunId, setNodeStatus]);

  const handleSelectWorkflow = (workflowId: string) => {
    const target = workflows.find((workflow) => workflow.id === workflowId);
    if (!target) return;

    setActiveWorkflowId(workflowId);
    setWorkflowName(target.name);
    setNodes(target.nodes);
    setEdges(target.edges);
    setSelectedNodeId(null);
    clearNodeStatuses();
    setWorkflowMeta(target.id, target.name);
  };

  const handleConnect = (connection: Connection) => {
    setEdges((existing) =>
      addEdge(
        {
          ...connection,
          id: crypto.randomUUID(),
          markerEnd: { type: MarkerType.ArrowClosed },
          animated: false,
        },
        existing
      )
    );
  };

  const handleSave = async () => {
    if (!activeWorkflowId) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/workflows/${activeWorkflowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: workflowName, nodes, edges }),
      });

      if (!response.ok) {
        throw new Error(`Save failed (${response.status})`);
      }

      const payload = await response.json();
      const updated = payload.workflow as WorkflowRecord;

      setWorkflows((current) =>
        current.map((workflow) =>
          workflow.id === updated.id
            ? {
                ...workflow,
                ...updated,
                nodes: normalizeNodes(updated.nodes),
                edges: normalizeEdges(updated.edges),
              }
            : workflow
        )
      );

      setWorkflowMeta(updated.id, updated.name);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateWorkflow = async () => {
    if (!selectedProfileId) return;

    const starterNodes = initialWorkflowNodes();
    const starterEdges: Edge[] = [
      {
        id: crypto.randomUUID(),
        source: starterNodes[0].id,
        target: starterNodes[1].id,
        markerEnd: { type: MarkerType.ArrowClosed },
      },
    ];

    const response = await fetch('/api/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Workflow ${workflows.length + 1}`,
        description: 'Custom automation flow',
        profile_id: selectedProfileId,
        nodes: starterNodes,
        edges: starterEdges,
      }),
    });

    if (!response.ok) return;

    const payload = await response.json();
    const created: WorkflowRecord = {
      ...payload.workflow,
      nodes: normalizeNodes(payload.workflow.nodes),
      edges: normalizeEdges(payload.workflow.edges),
    };

    setWorkflows((current) => [created, ...current]);
    setActiveWorkflowId(created.id);
    setWorkflowName(created.name);
    setNodes(created.nodes);
    setEdges(created.edges);
    setWorkflowMeta(created.id, created.name);
    setSelectedNodeId(null);
    clearNodeStatuses();
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    const type = event.dataTransfer.getData('application/x-node-type') as NodeType;
    if (!type || !flowInstance || !flowWrapperRef.current) return;

    const bounds = flowWrapperRef.current.getBoundingClientRect();
    const position = flowInstance.project({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });

    const nextNode: CanvasNode = {
      id: crypto.randomUUID(),
      type,
      position,
      data: defaultNodeData(type),
    };

    setNodes((existing) => existing.concat(nextNode));
    setSelectedNodeId(nextNode.id);
  };

  const updateSelectedNodeData = (patch: Partial<NodeData>) => {
    if (!selectedNodeId) return;

    setNodes((current) =>
      current.map((node) =>
        node.id === selectedNodeId
          ? {
              ...node,
              data: {
                ...node.data,
                ...patch,
              },
            }
          : node
      )
    );
  };

  const deleteSelectedNode = () => {
    if (!selectedNodeId) return;

    setNodes((current) => current.filter((node) => node.id !== selectedNodeId));
    setEdges((current) =>
      current.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId)
    );
    setSelectedNodeId(null);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-muted">Loading workflow canvas...</div>
    );
  }

  if (!selectedProfile) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-text-muted">
        <p>Select a profile to load its workflow canvas.</p>
        {profileLoadError && (
          <p className="max-w-xl text-center text-xs text-red-300">
            Profile loading failed: {profileLoadError}
          </p>
        )}
        <Link
          href="/settings/profiles"
          className="rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-xs text-text-primary transition hover:bg-bg-base"
        >
          Create or Manage Profiles
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden">
      <div className="flex h-12 items-center justify-between border-b border-border bg-bg-surface px-3">
        <div className="flex items-center gap-2">
          <select
            value={activeWorkflowId ?? ''}
            onChange={(event) => handleSelectWorkflow(event.target.value)}
            className="rounded-md border border-border bg-bg-elevated px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
          >
            {workflows.map((workflow) => (
              <option key={workflow.id} value={workflow.id}>
                {workflow.name}
              </option>
            ))}
          </select>
          <input
            value={workflowName}
            onChange={(event) => setWorkflowName(event.target.value)}
            className="rounded-md border border-border bg-bg-elevated px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={handleCreateWorkflow}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-elevated px-2 py-1.5 text-xs text-text-primary transition hover:bg-bg-base"
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </button>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !activeWorkflowId}
          className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-3.5 w-3.5" />
          {isSaving ? 'Saving...' : 'Save Workflow'}
        </button>
      </div>

      <div className="grid h-[calc(100%-3rem)] grid-cols-1 md:grid-cols-[220px_1fr_280px]">
        <NodePalette />

        <div
          ref={flowWrapperRef}
          className="h-full min-h-[380px] bg-[linear-gradient(to_bottom_right,rgba(0,119,181,0.08),transparent_55%)]"
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            onInit={setFlowInstance}
            fitView
          >
            <Background color="#2a2a3d" gap={20} size={1} />
            <Controls />
            <MiniMap
              pannable
              zoomable
              nodeColor={(node) => {
                const status = node.data?.status;
                if (status === 'running') return '#60a5fa';
                if (status === 'success') return '#22c55e';
                if (status === 'error') return '#ef4444';
                if (status === 'skipped') return '#f59e0b';
                return '#64748b';
              }}
            />
          </ReactFlow>
        </div>

        <NodeConfigPanel node={selectedNode} onUpdate={updateSelectedNodeData} onDelete={deleteSelectedNode} />
      </div>
    </div>
  );
}

export function WorkflowCanvas() {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner />
    </ReactFlowProvider>
  );
}

import type { WorkflowNode, WorkflowEdge } from '@/types';

export function findStartNode(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode | null {
  const loopNode = nodes.find(n => n.type === 'loop_leads');
  if (loopNode) return loopNode;

  const targetIds = new Set(edges.map(e => e.target));
  const rootNode = nodes.find(n => !targetIds.has(n.id));
  return rootNode || nodes[0] || null;
}

export function getNextNode(
  currentNode: WorkflowNode,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  sourceHandle?: string
): WorkflowNode | null {
  const outgoing = edges.filter(e => e.source === currentNode.id);
  let nextEdge: WorkflowEdge | undefined;

  if (sourceHandle) {
    nextEdge = outgoing.find(e => e.sourceHandle === sourceHandle) || outgoing[0];
  } else {
    nextEdge = outgoing[0];
  }

  if (!nextEdge) return null;
  return nodes.find(n => n.id === nextEdge!.target) || null;
}

export function validateWorkflow(nodes: WorkflowNode[], edges: WorkflowEdge[]): string[] {
  const errors: string[] = [];

  if (!nodes.length) {
    errors.push('Workflow has no nodes');
    return errors;
  }

  const startNode = findStartNode(nodes, edges);
  if (!startNode) {
    errors.push('Could not determine start node');
  }

  const nodeIds = new Set(nodes.map(n => n.id));
  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) errors.push(`Edge references missing source node: ${edge.source}`);
    if (!nodeIds.has(edge.target)) errors.push(`Edge references missing target node: ${edge.target}`);
  }

  return errors;
}

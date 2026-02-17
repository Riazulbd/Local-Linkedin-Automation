'use client';

import { Trash2 } from 'lucide-react';
import type { Node } from 'reactflow';
import type { NodeData } from '@/types';

type ConfigNodeData = NodeData & {
  status?: 'running' | 'success' | 'error' | 'skipped';
  highlighted?: boolean;
};

interface NodeConfigPanelProps {
  node: Node<ConfigNodeData> | null;
  onUpdate: (patch: Partial<NodeData>) => void;
  onDelete: () => void;
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-text-muted">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="rounded-md border border-border bg-bg-base px-2.5 py-2 text-xs text-text-primary outline-none transition focus:border-accent"
      />
    </label>
  );
}

export function NodeConfigPanel({ node, onUpdate, onDelete }: NodeConfigPanelProps) {
  if (!node) {
    return (
      <aside className="h-full border-l border-border bg-bg-surface p-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">Node Config</h2>
        <p className="mt-3 text-sm text-text-faint">Select a node to edit action settings.</p>
      </aside>
    );
  }

  const data = node.data;

  return (
    <aside className="h-full overflow-y-auto border-l border-border bg-bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">Node Config</h2>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-elevated px-2 py-1 text-[11px] text-text-muted transition hover:border-red-500/50 hover:text-red-400"
        >
          <Trash2 className="h-3 w-3" />
          Delete
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <TextInput label="Label" value={data.label ?? ''} onChange={(value) => onUpdate({ label: value })} />

        {node.type === 'visit_profile' && (
          <>
            <label className="flex items-center gap-2 text-xs text-text-muted">
              <input
                type="checkbox"
                checked={Boolean(data.useCurrentLead)}
                onChange={(event) => onUpdate({ useCurrentLead: event.target.checked })}
                className="h-3.5 w-3.5 rounded border-border bg-bg-base"
              />
              Use current lead LinkedIn URL
            </label>
            {!data.useCurrentLead && (
              <TextInput
                label="Profile URL"
                value={data.url ?? ''}
                onChange={(value) => onUpdate({ url: value })}
                placeholder="https://www.linkedin.com/in/..."
              />
            )}
          </>
        )}

        {node.type === 'send_message' && (
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Message Template
            <textarea
              value={data.messageTemplate ?? ''}
              onChange={(event) => onUpdate({ messageTemplate: event.target.value })}
              rows={8}
              placeholder="Hi {{firstName}}, great to connect..."
              className="mono rounded-md border border-border bg-bg-base px-2.5 py-2 text-xs text-text-primary outline-none transition focus:border-accent"
            />
          </label>
        )}

        {node.type === 'send_connection' && (
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Connection Note
            <textarea
              value={data.connectionNote ?? ''}
              onChange={(event) => onUpdate({ connectionNote: event.target.value })}
              rows={5}
              placeholder="Optional invitation note"
              className="mono rounded-md border border-border bg-bg-base px-2.5 py-2 text-xs text-text-primary outline-none transition focus:border-accent"
            />
          </label>
        )}

        {node.type === 'follow_profile' && (
          <label className="flex items-center gap-2 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={data.fallbackToConnect !== false}
              onChange={(event) => onUpdate({ fallbackToConnect: event.target.checked })}
              className="h-3.5 w-3.5 rounded border-border bg-bg-base"
            />
            Fallback to connect if follow unavailable
          </label>
        )}

        {node.type === 'wait_delay' && (
          <>
            <label className="flex items-center gap-2 text-xs text-text-muted">
              <input
                type="checkbox"
                checked={Boolean(data.useRandomRange)}
                onChange={(event) => onUpdate({ useRandomRange: event.target.checked })}
                className="h-3.5 w-3.5 rounded border-border bg-bg-base"
              />
              Use random range
            </label>

            {data.useRandomRange ? (
              <div className="grid grid-cols-2 gap-2">
                <TextInput
                  label="Min seconds"
                  value={String(data.minSeconds ?? 3)}
                  onChange={(value) => onUpdate({ minSeconds: Number(value) || 0 })}
                />
                <TextInput
                  label="Max seconds"
                  value={String(data.maxSeconds ?? 10)}
                  onChange={(value) => onUpdate({ maxSeconds: Number(value) || 0 })}
                />
              </div>
            ) : (
              <TextInput
                label="Seconds"
                value={String(data.seconds ?? 5)}
                onChange={(value) => onUpdate({ seconds: Number(value) || 0 })}
              />
            )}
          </>
        )}

        {node.type === 'if_condition' && (
          <>
            <TextInput
              label="Condition"
              value={data.condition ?? 'connection_status'}
              onChange={(value) => onUpdate({ condition: value })}
              placeholder="connection_status"
            />
            <TextInput
              label="Condition Value"
              value={data.conditionValue ?? ''}
              onChange={(value) => onUpdate({ conditionValue: value })}
              placeholder="connected"
            />
          </>
        )}
      </div>
    </aside>
  );
}

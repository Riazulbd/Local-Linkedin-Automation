'use client';

import { useEffect, useMemo, useRef } from 'react';
import { RefreshCcw } from 'lucide-react';
import { LogEntry } from './LogEntry';
import { useExecutionStore } from '@/store/executionStore';
import { useLeadsStore } from '@/store/leadsStore';
import { useWorkflowStore } from '@/store/workflowStore';
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { ExecutionLog as ExecutionLogType } from '@/types';

export function ExecutionLog() {
  const currentRunId = useExecutionStore((state) => state.currentRunId);
  const logs = useExecutionStore((state) => state.logs);
  const setLogs = useExecutionStore((state) => state.setLogs);
  const addLog = useExecutionStore((state) => state.addLog);
  const runState = useExecutionStore((state) => state.runState);

  const leads = useLeadsStore((state) => state.leads);
  const refreshLeads = useLeadsStore((state) => state.refreshLeads);

  const setHighlightedNodeId = useWorkflowStore((state) => state.setHighlightedNodeId);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const leadNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const lead of leads) {
      const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim();
      map.set(lead.id, fullName || lead.linkedin_url);
    }
    return map;
  }, [leads]);

  useEffect(() => {
    refreshLeads().catch(() => undefined);
  }, [refreshLeads]);

  useEffect(() => {
    const loadLogs = async () => {
      if (!currentRunId) {
        setLogs([]);
        return;
      }

      const response = await fetch(`/api/executions?runId=${currentRunId}`, { cache: 'no-store' });
      if (!response.ok) return;

      const payload = await response.json();
      setLogs((payload.logs ?? []) as ExecutionLogType[]);
    };

    loadLogs().catch(() => undefined);
  }, [currentRunId, setLogs]);

  useEffect(() => {
    if (!currentRunId) return;

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`execution-logs-${currentRunId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'execution_logs',
          filter: `run_id=eq.${currentRunId}`,
        },
        (payload) => {
          addLog(payload.new as ExecutionLogType);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(() => undefined);
    };
  }, [addLog, currentRunId]);

  useEffect(() => {
    const target = containerRef.current;
    if (!target) return;
    target.scrollTop = target.scrollHeight;
  }, [logs]);

  return (
    <div className="h-full overflow-hidden p-4 md:p-6">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">Execution Logs</h3>
            <p className="mt-1 text-xs text-text-muted">
              {currentRunId ? `Run ${currentRunId.slice(0, 8)} - ${runState}` : 'No active run selected'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => refreshLeads()}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-elevated px-2 py-1.5 text-xs text-text-primary transition hover:bg-bg-base"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        <div ref={containerRef} className="flex-1 overflow-y-auto">
          {logs.length ? (
            logs.map((log) => (
              <LogEntry
                key={log.id}
                log={{
                  ...log,
                  leadName: log.lead_id ? leadNameById.get(log.lead_id) : undefined,
                }}
                onClick={() => setHighlightedNodeId(log.node_id)}
              />
            ))
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-sm text-text-faint">
              No logs yet. Start a workflow run to stream execution events.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



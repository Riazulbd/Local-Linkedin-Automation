'use client';

import { useEffect, useMemo, useState } from 'react';
import { PauseCircle, PlayCircle, Loader2, Activity, Database, CheckCircle2, XCircle } from 'lucide-react';
import { useWorkflowStore } from '@/store/workflowStore';
import { useLeadsStore } from '@/store/leadsStore';
import { useExecutionStore } from '@/store/executionStore';
import { useProfileStore } from '@/store/profileStore';
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

export function StatusBar() {
  const workflowId = useWorkflowStore((state) => state.workflowId);
  const leads = useLeadsStore((state) => state.leads);
  const selectedLeadIds = useLeadsStore((state) => state.selectedLeadIds);
  const refreshLeads = useLeadsStore((state) => state.refreshLeads);
  const runState = useExecutionStore((state) => state.runState);
  const currentRunId = useExecutionStore((state) => state.currentRunId);
  const setCurrentRun = useExecutionStore((state) => state.setCurrentRun);
  const setRunState = useExecutionStore((state) => state.setRunState);
  const clearLogs = useExecutionStore((state) => state.clearLogs);
  const selectedProfile = useProfileStore((state) => state.selectedProfile);
  const selectedProfileId = selectedProfile?.id ?? null;

  const [requestLoading, setRequestLoading] = useState(false);

  const pendingLeads = useMemo(
    () => leads.filter((lead) => lead.status === 'pending'),
    [leads]
  );

  const canRun =
    Boolean(workflowId) &&
    Boolean(selectedProfileId) &&
    pendingLeads.length > 0 &&
    runState !== 'running';

  useEffect(() => {
    refreshLeads().catch(() => undefined);
  }, [refreshLeads]);

  useEffect(() => {
    if (!selectedProfileId) {
      setCurrentRun(null);
      setRunState('idle');
      clearLogs();
      return;
    }

    const loadLatestRun = async () => {
      const response = await fetch(`/api/executions?latest=true&profileId=${selectedProfileId}`, { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json();
      if (payload.run) {
        setCurrentRun(payload.run);
        setRunState(payload.run.status ?? 'idle');
        return;
      }
      setCurrentRun(null);
      setRunState('idle');
    };

    loadLatestRun().catch(() => undefined);

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`execution-runs-statusbar-${selectedProfileId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'execution_runs',
          filter: `profile_id=eq.${selectedProfileId}`,
        },
        (payload) => {
          const nextRun = payload.new as {
            id: string;
            profile_id: string;
            status: 'running' | 'completed' | 'stopped' | 'failed';
            workflow_id: string;
            leads_total: number;
            leads_completed: number;
            leads_failed: number;
            started_at: string;
            completed_at: string | null;
          };

          if (!nextRun?.id) return;

          setCurrentRun({
            id: nextRun.id,
            profile_id: nextRun.profile_id,
            workflow_id: nextRun.workflow_id,
            status: nextRun.status,
            leads_total: nextRun.leads_total,
            leads_completed: nextRun.leads_completed,
            leads_failed: nextRun.leads_failed,
            started_at: nextRun.started_at,
            completed_at: nextRun.completed_at,
          });
          setRunState(nextRun.status);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(() => undefined);
    };
  }, [clearLogs, selectedProfileId, setCurrentRun, setRunState]);

  const handleRun = async () => {
    if (!workflowId || !selectedProfileId) return;

    setRequestLoading(true);
    clearLogs();

    const ids = selectedLeadIds.length
      ? selectedLeadIds
      : pendingLeads.map((lead) => lead.id);

    try {
      const response = await fetch('/api/automation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId,
          linkedinProfileId: selectedProfileId,
          leadIds: ids,
        }),
      });

      if (!response.ok) {
        throw new Error(`Start failed with status ${response.status}`);
      }

      const payload = await response.json();
      setRunState('running');

      if (payload.runId) {
        setCurrentRun({
          id: payload.runId,
          profile_id: selectedProfileId,
          workflow_id: workflowId,
          status: 'running',
          leads_total: ids.length,
          leads_completed: 0,
          leads_failed: 0,
          started_at: new Date().toISOString(),
          completed_at: null,
        });
      }

      refreshLeads().catch(() => undefined);
    } catch {
      setRunState('failed');
    } finally {
      setRequestLoading(false);
    }
  };

  const handleStop = async () => {
    if (!selectedProfileId) return;
    setRequestLoading(true);
    try {
      await fetch('/api/automation/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedinProfileId: selectedProfileId }),
      });
      setRunState('stopped');
      refreshLeads().catch(() => undefined);
    } finally {
      setRequestLoading(false);
    }
  };

  const statusConfig = {
    running: { icon: Activity, color: 'text-accent', text: 'Active Mission' },
    failed: { icon: XCircle, color: 'text-error', text: 'Mission Failed' },
    stopped: { icon: PauseCircle, color: 'text-warning', text: 'Mission Paused' },
    completed: { icon: CheckCircle2, color: 'text-success', text: 'Mission Accomplished' },
    ready: { icon: Database, color: 'text-slate-500', text: 'Ready for Tasking' },
  };

  const currentStatus = (statusConfig[runState as keyof typeof statusConfig] || statusConfig.ready);
  const StatusIcon = currentStatus.icon;

  return (
    <footer className="z-50 flex h-14 items-center justify-between border-t border-slate-200 bg-slate-50 px-6 text-[11px] font-semibold tracking-wider text-slate-600">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-1">
          <button
            type="button"
            disabled={!canRun || requestLoading}
            onClick={handleRun}
            className={cn(
              "flex h-8 items-center gap-2 rounded-lg px-4 transition-all duration-300",
              canRun
                ? "bg-slate-900 text-white hover:bg-slate-800 active:scale-95"
                : "bg-slate-200 text-slate-400"
            )}
          >
            {requestLoading && runState !== 'running' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PlayCircle className="h-3.5 w-3.5" />
            )}
            <span className="uppercase">Execute Workflow</span>
          </button>

          <button
            type="button"
            disabled={(runState !== 'running' && !currentRunId) || requestLoading}
            onClick={handleStop}
            className={cn(
              "flex h-8 items-center gap-2 rounded-lg border border-slate-300 px-4 transition-all duration-300",
              (runState === 'running' || currentRunId)
                ? "bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 active:scale-95"
                : "opacity-20 grayscale"
            )}
          >
            <PauseCircle className="h-3.5 w-3.5" />
            <span className="uppercase">Abort</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2 text-slate-500 transition-all duration-500">
          <Database className="h-3.5 w-3.5" />
          <span>LEADS IN QUEUE: <span className="text-slate-900">{pendingLeads.length}</span></span>
        </div>

        <div className={cn(
          "flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 transition-all duration-500",
          currentStatus.color
        )}>
          <StatusIcon className={cn("h-3.5 w-3.5", runState === 'running' && "animate-pulse")} />
          <span className="uppercase">{currentStatus.text}</span>
          {currentRunId && runState === 'running' && (
            <span className="ml-1 opacity-60">#{currentRunId.slice(0, 6)}</span>
          )}
        </div>
      </div>
    </footer>
  );
}

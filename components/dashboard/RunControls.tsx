'use client';

import { useState } from 'react';
import { PlayCircle, PauseCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useExecutionStore } from '@/store/executionStore';
import { useProfileStore } from '@/store/profileStore';

interface RunControlsProps {
  workflowId: string | null;
  pendingLeadIds: string[];
  selectedLeadIds: string[];
}

export function RunControls({ workflowId, pendingLeadIds, selectedLeadIds }: RunControlsProps) {
  const currentRunId = useExecutionStore((state) => state.currentRunId);
  const runState = useExecutionStore((state) => state.runState);
  const setRunState = useExecutionStore((state) => state.setRunState);
  const setCurrentRun = useExecutionStore((state) => state.setCurrentRun);
  const clearLogs = useExecutionStore((state) => state.clearLogs);
  const selectedProfile = useProfileStore((state) => state.selectedProfile);
  const [loading, setLoading] = useState(false);
  const isRunning = runState === 'running';

  const canRun = Boolean(workflowId) && Boolean(selectedProfile) && pendingLeadIds.length > 0 && !isRunning;

  const handleRun = async () => {
    if (!workflowId || !selectedProfile) return;
    setLoading(true);
    clearLogs();
    try {
      const ids = selectedLeadIds.length ? selectedLeadIds : pendingLeadIds;
      const response = await fetch('/api/automation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId,
          linkedinProfileId: selectedProfile.id,
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
          profile_id: selectedProfile.id,
          workflow_id: workflowId,
          status: 'running',
          leads_total: ids.length,
          leads_completed: 0,
          leads_failed: 0,
          started_at: new Date().toISOString(),
          completed_at: null,
        });
      }
    } catch {
      setRunState('failed');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    if (!selectedProfile) return;
    setLoading(true);
    try {
      await fetch('/api/automation/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedinProfileId: selectedProfile.id }),
      });
      setRunState('stopped');
      if (!currentRunId) {
        setCurrentRun(null);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={!canRun || loading}
        onClick={handleRun}
        className={cn(
          'flex h-8 items-center gap-2 rounded-lg px-4 transition-all duration-300',
          canRun
            ? 'bg-accent text-white shadow-glow hover:bg-accent-hover active:scale-95'
            : 'bg-white/5 text-white/20'
        )}
      >
        {loading && !isRunning ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <PlayCircle className="h-3.5 w-3.5" />
        )}
        <span className="text-[11px] font-bold uppercase">Execute</span>
      </button>

      <button
        type="button"
        disabled={!isRunning || loading}
        onClick={handleStop}
        className={cn(
          'flex h-8 items-center gap-2 rounded-lg border border-white/10 px-4 transition-all duration-300',
          isRunning
            ? 'bg-white/5 text-white/70 hover:bg-white/10 active:scale-95'
            : 'opacity-20 grayscale'
        )}
      >
        <PauseCircle className="h-3.5 w-3.5" />
        <span className="text-[11px] font-bold uppercase">Abort</span>
      </button>
    </div>
  );
}

import { create } from 'zustand';
import type { ExecutionLog, ExecutionRun } from '@/types';

type RunState = 'idle' | 'running' | 'completed' | 'stopped' | 'failed';

interface ExecutionState {
  currentRunId: string | null;
  runState: RunState;
  run: ExecutionRun | null;
  logs: ExecutionLog[];
  setCurrentRun: (run: ExecutionRun | null) => void;
  setRunState: (state: RunState) => void;
  addLog: (log: ExecutionLog) => void;
  setLogs: (logs: ExecutionLog[]) => void;
  clearLogs: () => void;
}

export const useExecutionStore = create<ExecutionState>((set) => ({
  currentRunId: null,
  runState: 'idle',
  run: null,
  logs: [],

  setCurrentRun: (run) =>
    set({
      run,
      currentRunId: run?.id ?? null,
      runState: run?.status ?? 'idle',
    }),

  setRunState: (runState) => set({ runState }),

  addLog: (log) =>
    set((state) => {
      if (state.logs.some((entry) => entry.id === log.id)) {
        return state;
      }
      return { logs: [...state.logs, log] };
    }),

  setLogs: (logs) => set({ logs }),

  clearLogs: () => set({ logs: [] }),
}));

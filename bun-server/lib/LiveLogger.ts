import { supabase } from './supabase';
import type { LogStatus } from '../../types/execution.types';

export interface LogEntry {
  runId: string;
  leadId?: string;
  nodeId: string;
  nodeType: string;
  status: LogStatus;
  message: string;
  resultData?: Record<string, unknown>;
  isTest?: boolean;
  timestamp: string;
}

class LiveLoggerClass {
  private listeners = new Map<string, Array<(log: LogEntry) => void>>();

  async log(entry: LogEntry): Promise<void> {
    const listeners = this.listeners.get(entry.runId) ?? [];
    for (const callback of listeners) {
      callback(entry);
    }

    const icons: Record<LogStatus, string> = {
      running: 'RUN',
      success: 'OK',
      error: 'ERR',
      skipped: 'SKIP',
      info: 'INFO',
    };
    const icon = icons[entry.status] || 'LOG';
    const leadSuffix = entry.leadId ? ` [lead:${entry.leadId.slice(0, 8)}]` : '';
    console.log(`${icon} [${entry.nodeType}]${leadSuffix} ${entry.message}`);

    try {
      await supabase.from('execution_logs').insert({
        run_id: entry.runId,
        lead_id: entry.leadId ?? null,
        node_id: entry.nodeId,
        node_type: entry.nodeType,
        status: entry.status,
        message: entry.message,
        result_data: entry.resultData ?? {},
        is_test: entry.isTest ?? false,
      });
    } catch (error) {
      console.error('[LiveLogger] Failed to persist log entry:', error);
    }
  }

  subscribe(runId: string, callback: (log: LogEntry) => void): () => void {
    const list = this.listeners.get(runId) ?? [];
    list.push(callback);
    this.listeners.set(runId, list);

    return () => {
      const current = this.listeners.get(runId);
      if (!current?.length) return;

      const index = current.indexOf(callback);
      if (index >= 0) {
        current.splice(index, 1);
      }

      if (!current.length) {
        this.listeners.delete(runId);
      } else {
        this.listeners.set(runId, current);
      }
    };
  }
}

export const LiveLogger = new LiveLoggerClass();

export class Logger {
  constructor(private runId?: string | null) {}

  async log(
    nodeId: string,
    nodeType: string,
    status: LogStatus,
    message: string,
    leadId?: string,
    resultData?: Record<string, unknown>,
    isTest = false
  ): Promise<void> {
    if (!this.runId) {
      const icon = status.toUpperCase();
      const leadSuffix = leadId ? ` [lead:${leadId.slice(0, 8)}]` : '';
      console.log(`${icon} [${nodeType}]${leadSuffix} ${message}`);
      return;
    }

    await LiveLogger.log({
      runId: this.runId,
      leadId,
      nodeId,
      nodeType,
      status,
      message,
      resultData,
      isTest,
      timestamp: new Date().toISOString(),
    });
  }
}

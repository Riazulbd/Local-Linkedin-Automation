'use client';

import { useEffect, useMemo, useState } from 'react';

interface StreamLogEntry {
  runId: string;
  nodeType: string;
  status: 'running' | 'success' | 'error' | 'skipped' | 'info';
  message: string;
  timestamp: string;
}

const STATUS_STYLES: Record<StreamLogEntry['status'], string> = {
  running: 'bg-blue-50 text-blue-700 border-blue-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  skipped: 'bg-amber-50 text-amber-700 border-amber-200',
  info: 'bg-slate-50 text-slate-700 border-slate-200',
};

export function LiveLogStream({ runId }: { runId: string }) {
  const [logs, setLogs] = useState<StreamLogEntry[]>([]);
  const [connected, setConnected] = useState(false);

  const streamUrl = useMemo(() => {
    const configured = process.env.NEXT_PUBLIC_BUN_SERVER_URL?.trim();
    if (configured) {
      return `${configured.replace(/\/$/, '')}/logs/stream/${runId}`;
    }

    if (typeof window !== 'undefined') {
      return `http://${window.location.hostname}:3001/logs/stream/${runId}`;
    }

    return `http://localhost:3001/logs/stream/${runId}`;
  }, [runId]);

  useEffect(() => {
    setLogs([]);
    const source = new EventSource(streamUrl);

    source.onopen = () => {
      setConnected(true);
    };

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as StreamLogEntry;
        setLogs((prev) => [...prev, payload]);
      } catch {
        // ignore malformed log payloads
      }
    };

    source.onerror = () => {
      setConnected(false);
    };

    return () => {
      source.close();
      setConnected(false);
    };
  }, [streamUrl]);

  return (
    <div className="rounded-xl border border-border bg-bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Live Log Stream</p>
        <span className={`text-[11px] ${connected ? 'text-emerald-600' : 'text-amber-600'}`}>
          {connected ? 'Connected' : 'Reconnecting...'}
        </span>
      </div>

      <div className="max-h-80 space-y-2 overflow-y-auto">
        {logs.length === 0 ? (
          <p className="py-3 text-center text-xs text-text-faint">Waiting for log events...</p>
        ) : (
          logs.map((log, index) => (
            <div
              key={`${log.timestamp}-${index}`}
              data-animate="log-entry"
              className="flex items-start gap-2 rounded-md border border-border bg-bg-base p-2"
            >
              <span
                className={`mt-0.5 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${STATUS_STYLES[log.status]}`}
              >
                {log.status}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-text-muted">{log.nodeType}</p>
                <p className="text-xs text-text-primary">{log.message}</p>
              </div>
              <span className="shrink-0 text-[10px] text-text-faint">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

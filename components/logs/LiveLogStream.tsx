'use client';

import { useEffect, useMemo, useState } from 'react';
import { Box, Chip, Paper, Stack, Typography } from '@mui/material';

interface LogEntry {
  nodeType: string;
  status: 'running' | 'success' | 'error' | 'skipped' | 'info';
  message: string;
  timestamp: string;
}

function resolveStreamUrl(runId: string): string {
  const configured = process.env.NEXT_PUBLIC_BUN_SERVER_URL?.trim();
  if (configured) {
    return `${configured.replace(/\/$/, '')}/logs/stream/${runId}`;
  }

  if (typeof window !== 'undefined') {
    return `http://${window.location.hostname}:3001/logs/stream/${runId}`;
  }

  return `http://localhost:3001/logs/stream/${runId}`;
}

export function LiveLogStream({ runId }: { runId: string }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const streamUrl = useMemo(() => resolveStreamUrl(runId), [runId]);

  useEffect(() => {
    setLogs([]);
    const eventSource = new EventSource(streamUrl);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as LogEntry;
        setLogs((prev) => [...prev, payload]);
      } catch {
        // Ignore malformed log payloads.
      }
    };

    return () => eventSource.close();
  }, [streamUrl]);

  const statusColor = (status: string) =>
    (
      {
        running: 'info',
        success: 'success',
        error: 'error',
        skipped: 'warning',
        info: 'default',
      } as const
    )[status as 'running' | 'success' | 'error' | 'skipped' | 'info'] ?? 'default';

  return (
    <Paper sx={{ p: 2, maxHeight: 420, overflow: 'auto', fontFamily: 'monospace', fontSize: '0.8125rem' }}>
      <Stack spacing={1}>
        {logs.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Waiting for log events...
          </Typography>
        ) : (
          logs.map((log, index) => (
            <Box
              key={`${log.timestamp}-${index}`}
              data-animate="log-entry"
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.5,
                py: 0.75,
                borderBottom: index < logs.length - 1 ? 1 : 0,
                borderColor: 'divider',
              }}
            >
              <Chip label={log.nodeType} color={statusColor(log.status)} size="small" sx={{ flexShrink: 0 }} />
              <Typography variant="body2" sx={{ flex: 1, color: 'text.secondary' }}>
                {log.message}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.6875rem' }}>
                {new Date(log.timestamp).toLocaleTimeString()}
              </Typography>
            </Box>
          ))
        )}
      </Stack>
    </Paper>
  );
}

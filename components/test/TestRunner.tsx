'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import type { NodeType, ExecutionLog as ExecutionLogType, ActionResult } from '@/types';
import { Terminal, Monitor, Play, AlertCircle, CheckCircle2, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { LogEntry } from '@/components/logs/LogEntry';
import { useProfileStore } from '@/store/profileStore';
import Link from 'next/link';

const NODE_OPTIONS: Array<{ type: NodeType; label: string }> = [
  { type: 'follow_profile', label: 'Follow Profile' },
  { type: 'send_message', label: 'Send Message' },
  { type: 'send_connection', label: 'Send Connection' },
  { type: 'check_connection', label: 'Check Connection' },
  { type: 'visit_profile', label: 'Visit Profile' },
  { type: 'wait_delay', label: 'Wait Delay' },
];

export function TestRunner() {
  const selectedProfile = useProfileStore((state) => state.selectedProfile);
  const [nodeType, setNodeType] = useState<NodeType>('follow_profile');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('Hi {{firstName}}, great to connect.');
  const [connectionNote, setConnectionNote] = useState('Hi {{firstName}}, I would like to connect.');
  const [waitSeconds, setWaitSeconds] = useState(5);

  const [isRunning, setIsRunning] = useState(false);
  const [testRunId, setTestRunId] = useState<string | null>(null);
  const [logs, setLogs] = useState<ExecutionLogType[]>([]);
  const [showBrowser, setShowBrowser] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);
  const [lastResult, setLastResult] = useState<ActionResult | null>(null);

  const logContainerRef = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createClient(), []);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Subscribe to test logs
  useEffect(() => {
    if (!testRunId) return;

    const channel = supabase
      .channel(`test-logs-${testRunId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'execution_logs',
          filter: `run_id=eq.${testRunId}`,
        },
        (payload) => {
          setLogs((prev) => [...prev, payload.new as ExecutionLogType]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(() => undefined);
    };
  }, [testRunId, supabase]);

  const nodeData = useMemo(() => {
    if (nodeType === 'send_message') return { messageTemplate };
    if (nodeType === 'send_connection') return { connectionNote };
    if (nodeType === 'wait_delay') return { seconds: waitSeconds, useRandomRange: false };
    if (nodeType === 'visit_profile') return { useCurrentLead: true };
    return {};
  }, [connectionNote, messageTemplate, nodeType, waitSeconds]);

  const runTest = async () => {
    if (!linkedinUrl.trim() || !selectedProfile) return;

    setIsRunning(true);
    setLogs([]);
    setLastResult(null);
    const newTestRunId = `test_${Date.now()}`;
    setTestRunId(newTestRunId);

    try {
      const response = await fetch('/api/automation/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeType,
          nodeData,
          linkedinUrl: linkedinUrl.trim(),
          linkedinProfileId: selectedProfile.id,
        }),
      });

      const result = await response.json();
      setLastResult(result);
    } catch (error) {
      console.error('Test run failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-4 md:p-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-text-primary">Node Control Center</h2>
          <p className="text-sm text-text-muted">Test individual automation nodes with real-time feedback.</p>
        </div>
        <button
          onClick={runTest}
          disabled={isRunning || !linkedinUrl || !selectedProfile}
          className={cn(
            "flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold transition-all shadow-lg",
            isRunning
              ? "bg-bg-elevated text-text-faint cursor-not-allowed"
              : "bg-accent text-white hover:bg-accent-hover hover:scale-[1.02] active:scale-[0.98] shadow-accent/20"
          )}
        >
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Executing...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Launch Test
            </>
          )}
        </button>
      </div>

      <div className="grid flex-1 gap-4 overflow-hidden lg:grid-cols-12">
        {/* Configuration Panel */}
        <div className="flex flex-col gap-4 lg:col-span-4 xl:col-span-3">
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-bg-surface/50 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-muted">
              <Terminal className="h-4 w-4" />
              Configuration
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-bg-base px-3 py-2 text-xs text-text-muted">
                Profile:{' '}
                <span className="text-text-primary">{selectedProfile?.name || 'None selected'}</span>
                {!selectedProfile && (
                  <>
                    {' '}
                    -{' '}
                    <Link href="/settings/profiles" className="underline underline-offset-2">
                      create profile
                    </Link>
                  </>
                )}
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Node Type</span>
                <select
                  value={nodeType}
                  onChange={(e) => setNodeType(e.target.value as NodeType)}
                  className="w-full rounded-xl border border-border bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent/20 transition-all"
                >
                  {NODE_OPTIONS.map((opt) => (
                    <option key={opt.type} value={opt.type}>{opt.label}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Target Profile</span>
                <input
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="LinkedIn URL..."
                  className="w-full rounded-xl border border-border bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent/20 transition-all"
                />
              </label>

              {nodeType === 'send_message' && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Message Template</span>
                  <textarea
                    rows={4}
                    value={messageTemplate}
                    onChange={(e) => setMessageTemplate(e.target.value)}
                    className="w-full rounded-xl border border-border bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent/20 transition-all resize-none"
                  />
                </label>
              )}

              {nodeType === 'send_connection' && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Connection Note</span>
                  <textarea
                    rows={4}
                    value={connectionNote}
                    onChange={(e) => setConnectionNote(e.target.value)}
                    className="w-full rounded-xl border border-border bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent/20 transition-all resize-none"
                  />
                </label>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-bg-surface/50 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-muted">
                <AlertCircle className="h-4 w-4" />
                Live Logs
              </div>
              {isRunning && <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />}
            </div>

            <div
              ref={logContainerRef}
              className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar"
            >
              {logs.length > 0 ? (
                logs.map((log, i) => (
                  <LogEntry key={`${log.id}-${i}`} log={log} />
                ))
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center p-4">
                  <div className="rounded-full bg-bg-base p-3 mb-3">
                    <Terminal className="h-5 w-5 text-text-faint" />
                  </div>
                  <p className="text-xs text-text-faint">No active logs. Launch a test to see execution steps.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Browser Feed */}
        <div className={cn(
          "flex flex-col overflow-hidden rounded-2xl border border-border bg-black shadow-2xl transition-all duration-300",
          isMaximized ? "fixed inset-4 z-50" : "lg:col-span-8 xl:col-span-9"
        )}>
          <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-4 py-2">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
                <div className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
              </div>
              <div className="ml-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                <Monitor className="h-3.5 w-3.5" />
                Live Virtual Desktop
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBrowser(!showBrowser)}
                className="rounded-md p-1.5 text-white/60 hover:bg-white/10 transition-colors"
                title={showBrowser ? "Hide Browser" : "Show Browser"}
              >
                {showBrowser ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <button
                onClick={() => setIsMaximized(!isMaximized)}
                className="rounded-md p-1.5 text-white/60 hover:bg-white/10 transition-colors"
              >
                {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="relative flex-1 bg-[#1a1a1a]">
            {showBrowser ? (
              <iframe
                src={`http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:6080/vnc.html?autoconnect=true&resize=scale`}
                className="h-full w-full border-none"
                title="Browser Feed"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <Monitor className="mx-auto h-12 w-12 text-white/10 mb-4" />
                  <p className="text-sm text-white/40 font-medium">Feed Hidden</p>
                  <button
                    onClick={() => setShowBrowser(true)}
                    className="mt-4 text-xs font-semibold text-accent hover:underline"
                  >
                    Reconnect Visual Stream
                  </button>
                </div>
              </div>
            )}

            {/* Status Overlay */}
            {lastResult && (
              <div className="absolute bottom-6 right-6 flex animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className={cn(
                  "flex items-center gap-3 rounded-2xl border p-4 shadow-2xl backdrop-blur-xl",
                  lastResult.success
                    ? "border-green-500/30 bg-green-500/10 text-green-400"
                    : "border-red-500/30 bg-red-500/10 text-red-400"
                )}>
                  {lastResult.success ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider">Test Result</div>
                    <div className="text-sm font-medium">
                      {lastResult.success ? "Automation successful" : lastResult.error || "Execution failed"}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Grid,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  CheckCircle,
  Error as ErrorIcon,
  HourglassEmpty,
  Info,
  KeyboardArrowDown,
  KeyboardArrowUp,
  Refresh,
  Stop,
} from '@mui/icons-material';
import { createClient } from '@/lib/supabase/client';

interface SequenceStep {
  label?: string;
  type?: string;
  step_type?: string;
}

interface ExecutionRunRow {
  id: string;
  profile_id: string | null;
  campaign_id: string | null;
  status: 'running' | 'completed' | 'stopped' | 'failed';
  leads_total: number | null;
  leads_completed: number | null;
  leads_failed: number | null;
  started_at: string;
  linkedin_profiles: { name: string | null } | null;
  campaigns: { name: string | null; sequence: unknown } | null;
}

interface CampaignLeadProgressRow {
  current_step: number | null;
  next_action_at: string | null;
  status: string | null;
  leads: { first_name: string | null; last_name: string | null } | null;
}

interface ExecutionRun {
  id: string;
  profile_id: string;
  campaign_id: string;
  status: 'running' | 'completed' | 'stopped' | 'failed';
  leads_total: number;
  leads_completed: number;
  leads_failed: number;
  started_at: string;
  profile_name: string;
  campaign_name: string;
  sequence: SequenceStep[];
  current_step: number;
  current_lead_name: string;
  next_action_at: string | null;
  progress_status: string;
}

interface ExecutionLogRow {
  id: string;
  run_id: string;
  node_type: string;
  status: 'running' | 'success' | 'error' | 'skipped' | 'info';
  message: string | null;
  created_at: string;
  lead_id: string | null;
  leads: { first_name: string | null; last_name: string | null } | null;
}

interface ExecutionLog {
  id: string;
  run_id: string;
  node_type: string;
  status: 'running' | 'success' | 'error' | 'skipped' | 'info';
  message: string;
  created_at: string;
  lead_name: string;
}

function normalizeSequence(raw: unknown): SequenceStep[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry) => typeof entry === 'object' && entry !== null)
    .map((entry) => entry as SequenceStep);
}

function normalizeRun(row: ExecutionRunRow): ExecutionRun {
  return {
    id: row.id,
    profile_id: row.profile_id ?? '',
    campaign_id: row.campaign_id ?? '',
    status: row.status,
    leads_total: row.leads_total ?? 0,
    leads_completed: row.leads_completed ?? 0,
    leads_failed: row.leads_failed ?? 0,
    started_at: row.started_at,
    profile_name: row.linkedin_profiles?.name ?? 'Unknown Profile',
    campaign_name: row.campaigns?.name ?? 'Manual Test',
    sequence: normalizeSequence(row.campaigns?.sequence),
    current_step: 0,
    current_lead_name: '',
    next_action_at: null,
    progress_status: '',
  };
}

function normalizeLog(row: ExecutionLogRow): ExecutionLog {
  const firstName = row.leads?.first_name ?? '';
  const lastName = row.leads?.last_name ?? '';
  const leadName = `${firstName} ${lastName}`.trim();

  return {
    id: row.id,
    run_id: row.run_id,
    node_type: row.node_type,
    status: row.status,
    message: row.message ?? '',
    created_at: row.created_at,
    lead_name: leadName,
  };
}

function getStatusColor(status: ExecutionRun['status']) {
  return ({ running: 'info', completed: 'success', stopped: 'warning', failed: 'error' } as const)[status];
}

function getLogSeverity(status: ExecutionLog['status']) {
  return ({ running: 'info', success: 'success', error: 'error', skipped: 'warning', info: 'info' } as const)[status];
}

function getStatusIcon(status: ExecutionLog['status']) {
  const icons = {
    running: <HourglassEmpty color="info" />,
    success: <CheckCircle color="success" />,
    error: <ErrorIcon color="error" />,
    skipped: <Info color="warning" />,
    info: <Info color="disabled" />,
  };

  return icons[status];
}

function toLeadName(progress: CampaignLeadProgressRow | null): string {
  if (!progress?.leads) return '';
  const firstName = progress.leads.first_name ?? '';
  const lastName = progress.leads.last_name ?? '';
  return `${firstName} ${lastName}`.trim();
}

function getStepLabel(step: SequenceStep | undefined, fallbackIndex: number): string {
  if (!step) return `Step ${fallbackIndex + 1}`;
  return step.label || step.step_type || step.type || `Step ${fallbackIndex + 1}`;
}

function formatWaitLabel(nextActionAt: string | null): string | null {
  if (!nextActionAt) return null;
  const nextDate = new Date(nextActionAt);
  if (Number.isNaN(nextDate.getTime()) || nextDate <= new Date()) {
    return null;
  }
  return nextDate.toLocaleTimeString();
}

export default function MonitorPage() {
  const supabase = createClient();
  const [runs, setRuns] = useState<ExecutionRun[]>([]);
  const [logsByRun, setLogsByRun] = useState<Record<string, ExecutionLog[]>>({});
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stoppingRunId, setStoppingRunId] = useState<string | null>(null);

  const fetchRuns = useCallback(async () => {
    try {
      const { data, error: runsError } = await supabase
        .from('execution_runs')
        .select(
          'id, profile_id, campaign_id, status, leads_total, leads_completed, leads_failed, started_at, linkedin_profiles(name), campaigns(name, sequence)'
        )
        .in('status', ['running', 'completed', 'failed', 'stopped'])
        .order('started_at', { ascending: false })
        .limit(20);

      if (runsError) {
        throw runsError;
      }

      const normalized = ((data ?? []) as ExecutionRunRow[]).map(normalizeRun);
      const enriched = await Promise.all(
        normalized.map(async (run) => {
          if (run.status !== 'running' || !run.campaign_id) {
            return run;
          }

          const { data: progressData } = await supabase
            .from('campaign_lead_progress')
            .select('current_step, next_action_at, status, leads(first_name, last_name)')
            .eq('campaign_id', run.campaign_id)
            .in('status', ['active', 'in_progress', 'waiting', 'pending'])
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const progress = (progressData ?? null) as CampaignLeadProgressRow | null;
          return {
            ...run,
            current_step: progress?.current_step ?? 0,
            current_lead_name: toLeadName(progress),
            next_action_at: progress?.next_action_at ?? null,
            progress_status: progress?.status ?? '',
          };
        })
      );

      setRuns(enriched);
      setError('');
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load monitor data');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void fetchRuns();

    const interval = setInterval(() => {
      void fetchRuns();
    }, 3000);

    const channel = supabase
      .channel('execution-runs-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'execution_runs',
        },
        () => {
          void fetchRuns();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [fetchRuns, supabase]);

  useEffect(() => {
    if (!expandedRun) return;

    let mounted = true;

    const fetchLogs = async () => {
      const { data } = await supabase
        .from('execution_logs')
        .select('id, run_id, node_type, status, message, created_at, lead_id, leads(first_name, last_name)')
        .eq('run_id', expandedRun)
        .order('created_at', { ascending: false })
        .limit(150);

      if (!mounted) return;
      setLogsByRun((prev) => ({
        ...prev,
        [expandedRun]: ((data ?? []) as ExecutionLogRow[]).map(normalizeLog),
      }));
    };

    void fetchLogs();

    const channel = supabase
      .channel(`execution-logs-${expandedRun}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'execution_logs',
          filter: `run_id=eq.${expandedRun}`,
        },
        () => {
          void fetchLogs();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [expandedRun, supabase]);

  const stats = useMemo(() => {
    return {
      activeRuns: runs.filter((run) => run.status === 'running').length,
      leadsCompleted: runs.reduce((sum, run) => sum + run.leads_completed, 0),
      leadsFailed: runs.reduce((sum, run) => sum + run.leads_failed, 0),
      totalRuns: runs.length,
    };
  }, [runs]);

  const stopRun = async (run: ExecutionRun) => {
    if (!window.confirm('Stop this automation run?')) {
      return;
    }

    setStoppingRunId(run.id);
    setError('');

    setRuns((prev) => prev.map((entry) => (entry.id === run.id ? { ...entry, status: 'stopped' } : entry)));

    try {
      const response = await fetch('/api/automation/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId: run.id,
          profileId: run.profile_id || undefined,
          campaignId: run.campaign_id || undefined,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((payload.error as string) || 'Failed to stop automation run');
      }

      await fetchRuns();
    } catch (stopError) {
      setRuns((prev) =>
        prev.map((entry) => (entry.id === run.id ? { ...entry, status: run.status } : entry))
      );
      setError(stopError instanceof Error ? stopError.message : 'Failed to stop automation run');
    } finally {
      setStoppingRunId(null);
    }
  };

  return (
    <Box sx={{ p: 4 }} data-animate="page">
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" fontWeight={600}>
          Live Monitor
        </Typography>
        <Button startIcon={<Refresh />} onClick={() => void fetchRuns()}>
          Refresh
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'info.dark' }}>
            <CardContent>
              <Typography color="common.white" variant="h4" fontWeight={700}>
                {stats.activeRuns}
              </Typography>
              <Typography color="common.white" variant="body2">
                Active Runs
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'success.dark' }}>
            <CardContent>
              <Typography color="common.white" variant="h4" fontWeight={700}>
                {stats.leadsCompleted}
              </Typography>
              <Typography color="common.white" variant="body2">
                Leads Completed
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'error.dark' }}>
            <CardContent>
              <Typography color="common.white" variant="h4" fontWeight={700}>
                {stats.leadsFailed}
              </Typography>
              <Typography color="common.white" variant="body2">
                Leads Failed
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'warning.dark' }}>
            <CardContent>
              <Typography color="common.white" variant="h4" fontWeight={700}>
                {stats.totalRuns}
              </Typography>
              <Typography color="common.white" variant="body2">
                Total Runs
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>Profile</TableCell>
              <TableCell>Campaign</TableCell>
              <TableCell>Current Status</TableCell>
              <TableCell>Progress</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {runs.map((run) => {
              const progress = run.leads_total > 0 ? Math.round((run.leads_completed / run.leads_total) * 100) : 0;
              const isExpanded = expandedRun === run.id;
              const sequence = run.sequence;
              const safeTotalSteps = Math.max(1, sequence.length);
              const safeCurrentStep = Math.min(Math.max(0, run.current_step), safeTotalSteps - 1);
              const stepLabel = getStepLabel(sequence[safeCurrentStep], safeCurrentStep);
              const waitLabel = formatWaitLabel(run.next_action_at);
              const stepperActiveStep =
                run.status === 'completed' && sequence.length > 0
                  ? sequence.length
                  : Math.min(safeCurrentStep, Math.max(sequence.length - 1, 0));

              return (
                <Fragment key={run.id}>
                  <TableRow hover>
                    <TableCell>
                      <IconButton size="small" onClick={() => setExpandedRun(isExpanded ? null : run.id)}>
                        {isExpanded ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Chip label={run.profile_name} color="primary" size="small" />
                    </TableCell>
                    <TableCell>{run.campaign_name}</TableCell>
                    <TableCell>
                      {run.status === 'running' ? (
                        <Stack spacing={0.5}>
                          <Typography variant="caption" fontWeight={600}>
                            {run.current_lead_name || 'Processing lead...'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Step {safeCurrentStep + 1}/{safeTotalSteps}: {stepLabel}
                          </Typography>
                          {waitLabel && <Chip label={`Waiting until ${waitLabel}`} size="small" color="warning" />}
                        </Stack>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          {new Date(run.started_at).toLocaleString()}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <LinearProgress variant="determinate" value={progress} sx={{ flex: 1, height: 8, borderRadius: 1 }} />
                        <Typography variant="caption" fontWeight={600}>
                          {run.leads_completed}/{run.leads_total}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip label={run.status} color={getStatusColor(run.status)} size="small" />
                    </TableCell>
                    <TableCell>
                      {run.status === 'running' ? (
                        <Button
                          size="small"
                          color="error"
                          startIcon={<Stop />}
                          onClick={() => void stopRun(run)}
                          disabled={stoppingRunId === run.id}
                        >
                          {stoppingRunId === run.id ? 'Stopping...' : 'Stop'}
                        </Button>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          —
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell colSpan={7} sx={{ p: 0 }}>
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <Box sx={{ p: 3, bgcolor: 'background.default' }}>
                          {sequence.length > 0 && (
                            <Box sx={{ mb: 3 }}>
                              <Typography variant="h6" fontWeight={600} mb={2}>
                                Campaign Sequence
                              </Typography>
                              <Stepper activeStep={stepperActiveStep} alternativeLabel>
                                {sequence.map((step, index) => (
                                  <Step key={`${run.id}-step-${index}`}>
                                    <StepLabel>{getStepLabel(step, index)}</StepLabel>
                                  </Step>
                                ))}
                              </Stepper>
                            </Box>
                          )}

                          <Typography variant="h6" fontWeight={600} mb={2}>
                            Execution Logs
                          </Typography>
                          <Stack spacing={1} sx={{ maxHeight: 420, overflow: 'auto' }}>
                            {(logsByRun[run.id] ?? []).map((log) => (
                              <Alert key={log.id} severity={getLogSeverity(log.status)} icon={getStatusIcon(log.status)}>
                                <Stack direction="row" spacing={2} alignItems="center">
                                  <Chip label={log.node_type} size="small" />
                                  <Typography variant="body2" sx={{ flex: 1 }}>
                                    {log.message}
                                    {log.lead_name ? ` (${log.lead_name})` : ''}
                                  </Typography>
                                  <Typography variant="caption" color="text.disabled">
                                    {new Date(log.created_at).toLocaleTimeString()}
                                  </Typography>
                                </Stack>
                              </Alert>
                            ))}
                          </Stack>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </Fragment>
              );
            })}

            {!runs.length && !loading && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    No execution runs found.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {loading && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    Loading runs...
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

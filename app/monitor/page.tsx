'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Collapse,
  Grid,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
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
} from '@mui/icons-material';
import { createClient } from '@/lib/supabase/client';

interface ExecutionRunRow {
  id: string;
  profile_id: string | null;
  campaign_id: string | null;
  status: 'running' | 'completed' | 'stopped' | 'failed';
  leads_total: number;
  leads_completed: number;
  leads_failed: number;
  started_at: string;
  linkedin_profiles: { name: string } | null;
  campaigns: { name: string } | null;
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

export default function MonitorPage() {
  const supabase = createClient();
  const [runs, setRuns] = useState<ExecutionRun[]>([]);
  const [logsByRun, setLogsByRun] = useState<Record<string, ExecutionLog[]>>({});
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchRuns = async () => {
      const { data } = await supabase
        .from('execution_runs')
        .select('id, profile_id, campaign_id, status, leads_total, leads_completed, leads_failed, started_at, linkedin_profiles(name), campaigns(name)')
        .in('status', ['running', 'completed', 'failed', 'stopped'])
        .order('started_at', { ascending: false })
        .limit(20);

      if (!mounted) return;
      setRuns(((data ?? []) as ExecutionRunRow[]).map(normalizeRun));
    };

    void fetchRuns();

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
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  useEffect(() => {
    if (!expandedRun) return;

    let mounted = true;

    const fetchLogs = async () => {
      const { data } = await supabase
        .from('execution_logs')
        .select('id, run_id, node_type, status, message, created_at, lead_id, leads(first_name, last_name)')
        .eq('run_id', expandedRun)
        .order('created_at', { ascending: false })
        .limit(100);

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

  const getStatusColor = (status: string) =>
    ({ running: 'info', completed: 'success', stopped: 'warning', failed: 'error' } as const)[
      status as 'running' | 'completed' | 'stopped' | 'failed'
    ] ?? 'default';

  const getLogSeverity = (status: ExecutionLog['status']) =>
    ({ running: 'info', success: 'success', error: 'error', skipped: 'warning', info: 'info' } as const)[status];

  const getStatusIcon = (status: ExecutionLog['status']) => {
    const icons = {
      running: <HourglassEmpty color="info" />,
      success: <CheckCircle color="success" />,
      error: <ErrorIcon color="error" />,
      skipped: <Info color="warning" />,
      info: <Info color="disabled" />,
    };

    return icons[status];
  };

  return (
    <Box sx={{ p: 4 }} data-animate="page">
      <Typography variant="h4" fontWeight={600} mb={4}>
        Live Monitor
      </Typography>

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
              <TableCell>Progress</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Started</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {runs.map((run) => {
              const progress = run.leads_total > 0 ? Math.round((run.leads_completed / run.leads_total) * 100) : 0;
              const isExpanded = expandedRun === run.id;

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
                      <Typography variant="caption">{new Date(run.started_at).toLocaleString()}</Typography>
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell colSpan={6} sx={{ p: 0 }}>
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <Box sx={{ p: 3, bgcolor: 'background.default' }}>
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
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

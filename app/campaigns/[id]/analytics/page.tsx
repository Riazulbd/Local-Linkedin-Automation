'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { CampaignLeadProgress } from '@/types';

export default function CampaignAnalyticsPage() {
  const params = useParams<{ id: string }>();
  const campaignId = String(params?.id || '');

  const [progress, setProgress] = useState<CampaignLeadProgress[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!campaignId) return;
    let mounted = true;

    async function fetchData() {
      try {
        const response = await fetch(`/api/campaigns/${campaignId}`, { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Failed to load analytics');
        if (!mounted) return;
        setProgress((payload.progress ?? []) as CampaignLeadProgress[]);
      } catch (fetchError) {
        if (!mounted) return;
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load analytics');
      }
    }

    void fetchData();
    return () => {
      mounted = false;
    };
  }, [campaignId]);

  const metrics = useMemo(() => {
    const total = progress.length;
    const completed = progress.filter((row) => row.status === 'completed').length;
    const failed = progress.filter((row) => row.status === 'failed').length;
    const waiting = progress.filter((row) => row.status === 'waiting').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, failed, waiting, completionRate };
  }, [progress]);

  return (
    <Box sx={{ p: 4 }} data-animate="page">
      <Typography variant="h4" fontWeight={600} mb={3}>
        Campaign Analytics
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard label="Total Leads" value={metrics.total} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard label="Completed" value={metrics.completed} />
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <MetricCard label="Failed" value={metrics.failed} />
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <MetricCard label="Waiting" value={metrics.waiting} />
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <MetricCard label="Completion %" value={metrics.completionRate} />
        </Grid>
      </Grid>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" mb={1.5}>
          Recent Step Results
        </Typography>
        <TableContainer sx={{ maxHeight: 400 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Lead</TableCell>
                <TableCell>Step</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {progress.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell sx={{ fontFamily: 'var(--font-app-mono), monospace' }}>{row.lead_id.slice(0, 8)}</TableCell>
                  <TableCell>{row.current_step + 1}</TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell>{row.last_action_at ? new Date(row.last_action_at).toLocaleString() : '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h5" fontWeight={700} mt={0.5}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

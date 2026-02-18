'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import { ArrowForward, Campaign, Folder, Inbox, PlayArrow } from '@mui/icons-material';
import type { Campaign as CampaignType, Lead } from '@/types';

interface ExecutionRun {
  id: string;
  status: 'running' | 'completed' | 'stopped' | 'failed';
  leads_total: number;
  leads_completed: number;
  leads_failed: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignType[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [runs, setRuns] = useState<ExecutionRun[]>([]);

  useEffect(() => {
    fetch('/api/campaigns', { cache: 'no-store' })
      .then((response) => response.json().catch(() => ({})))
      .then((payload) => setCampaigns((payload.campaigns ?? []) as CampaignType[]))
      .catch(() => setCampaigns([]));

    fetch('/api/leads?limit=200', { cache: 'no-store' })
      .then((response) => response.json().catch(() => ({})))
      .then((payload) => setLeads((payload.leads ?? payload.data ?? []) as Lead[]))
      .catch(() => setLeads([]));

    fetch('/api/executions', { cache: 'no-store' })
      .then((response) => response.json().catch(() => ({})))
      .then((payload) => setRuns((payload.runs ?? []) as ExecutionRun[]))
      .catch(() => setRuns([]));
  }, []);

  const stats = useMemo(() => {
    const pendingLeads = leads.filter((lead) => lead.status === 'pending').length;
    const runningCampaigns = campaigns.filter((campaign) => campaign.status === 'active').length;
    const failedRuns = runs.filter((run) => run.status === 'failed').length;
    const activeRuns = runs.filter((run) => run.status === 'running').length;

    return {
      pendingLeads,
      runningCampaigns,
      failedRuns,
      activeRuns,
    };
  }, [campaigns, leads, runs]);

  return (
    <Box sx={{ p: 4 }} data-animate="page">
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" fontWeight={600}>
            Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Operations overview for campaigns, leads, and automation runs
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<PlayArrow />} onClick={() => router.push('/test')}>
          Run Test
        </Button>
      </Stack>

      <Grid container spacing={2.5} mb={4}>
        <Grid item xs={12} sm={6} lg={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Active Campaigns
              </Typography>
              <Typography variant="h4" mt={1}>
                {stats.runningCampaigns}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Pending Leads
              </Typography>
              <Typography variant="h4" mt={1}>
                {stats.pendingLeads}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Running Executions
              </Typography>
              <Typography variant="h4" mt={1}>
                {stats.activeRuns}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Failed Executions
              </Typography>
              <Typography variant="h4" mt={1}>
                {stats.failedRuns}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
                <Campaign fontSize="small" />
                <Typography variant="h6">Campaigns</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Manage campaign sequencing, start/stop runs, and monitor status.
              </Typography>
              <Button endIcon={<ArrowForward />} onClick={() => router.push('/campaigns')}>
                Open Campaigns
              </Button>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
                <Folder fontSize="small" />
                <Typography variant="h6">Leads</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Manage leads and place them into folders used by campaigns.
              </Typography>
              <Button endIcon={<ArrowForward />} onClick={() => router.push('/leads')}>
                Open Leads
              </Button>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
                <Inbox fontSize="small" />
                <Typography variant="h6">Unibox</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Review and synchronize LinkedIn conversations in one inbox.
              </Typography>
              <Button endIcon={<ArrowForward />} onClick={() => router.push('/unibox')}>
                Open Unibox
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

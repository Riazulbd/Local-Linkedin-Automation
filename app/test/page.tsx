'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import { PlayArrow, Stop } from '@mui/icons-material';
import { LiveLogStream } from '@/components/logs/LiveLogStream';
import { createClient } from '@/lib/supabase/client';
import type { Lead } from '@/types';

interface ProfileOption {
  id: string;
  name: string;
  adspower_profile_id: string | null;
}

type TestAction = 'visit' | 'connect' | 'message' | 'follow';

export default function TestLabPage() {
  const supabase = createClient();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [selectedLead, setSelectedLead] = useState('');
  const [selectedProfile, setSelectedProfile] = useState('');
  const [runId, setRunId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [showWarn, setShowWarn] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      const [leadsRes, profilesRes] = await Promise.all([
        supabase
          .from('leads')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('linkedin_profiles')
          .select('id, name, adspower_profile_id')
          .order('created_at', { ascending: true }),
      ]);

      if (!mounted) return;
      setLeads((leadsRes.data ?? []) as Lead[]);
      setProfiles((profilesRes.data ?? []) as ProfileOption[]);
    };

    void loadData();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  const selectedLeadData = useMemo(
    () => leads.find((lead) => lead.id === selectedLead) ?? null,
    [leads, selectedLead]
  );
  const selectedProfileData = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfile) ?? null,
    [profiles, selectedProfile]
  );

  const runTest = async (action: TestAction) => {
    if (!selectedLead || !selectedProfile) {
      setShowWarn(true);
      return;
    }

    setError('');
    setTesting(true);
    try {
      const response = await fetch('/api/automation/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          profileId: selectedProfile,
          leadId: selectedLead,
          messageTemplate: 'Hi {{firstName}}, this is a test message from the automation lab!',
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((payload.error as string) || 'Failed to run test');
      }

      setRunId((payload.runId as string) ?? null);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Failed to run test');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Box sx={{ p: 4 }} data-animate="page">
      <Typography variant="h4" fontWeight={600} mb={1}>
        Test Lab
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={4}>
        Test individual actions on real LinkedIn profiles safely
      </Typography>

      <Stack spacing={3}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} mb={3} color="primary.main">
            1. Select LinkedIn Profile (AdsPower)
          </Typography>
          <FormControl fullWidth>
            <InputLabel>LinkedIn Profile</InputLabel>
            <Select
              value={selectedProfile}
              onChange={(event) => setSelectedProfile(String(event.target.value))}
              label="LinkedIn Profile"
            >
              <MenuItem value="">-- Select profile --</MenuItem>
              {profiles.map((profile) => (
                <MenuItem key={profile.id} value={profile.id}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Chip label={profile.name} color="primary" size="small" />
                    <Typography variant="caption" color="text.secondary">
                      AdsPower: {profile.adspower_profile_id ?? 'N/A'}
                    </Typography>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {selectedProfileData && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Using profile: <strong>{selectedProfileData.name}</strong> (AdsPower ID:{' '}
              {selectedProfileData.adspower_profile_id ?? 'N/A'})
            </Alert>
          )}
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} mb={3} color="success.main">
            2. Select Target Lead
          </Typography>
          <FormControl fullWidth>
            <InputLabel>Lead</InputLabel>
            <Select value={selectedLead} onChange={(event) => setSelectedLead(String(event.target.value))} label="Lead">
              <MenuItem value="">-- Select lead --</MenuItem>
              {leads.map((lead) => (
                <MenuItem key={lead.id} value={lead.id}>
                  {`${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim() || 'Unnamed'} ({lead.company || 'No company'})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {selectedLeadData && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Target: <strong>{`${selectedLeadData.first_name ?? ''} ${selectedLeadData.last_name ?? ''}`.trim() || 'Unnamed'}</strong>
              <br />
              <a href={selectedLeadData.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                {selectedLeadData.linkedin_url}
              </a>
            </Alert>
          )}
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} mb={3} color="warning.main">
            3. Run Test Action
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Button
              variant="contained"
              color="primary"
              startIcon={testing ? <Stop /> : <PlayArrow />}
              onClick={() => runTest('visit')}
              disabled={!selectedLead || !selectedProfile || testing}
              size="large"
            >
              Visit Profile
            </Button>
            <Button
              variant="contained"
              color="success"
              startIcon={<PlayArrow />}
              onClick={() => runTest('connect')}
              disabled={!selectedLead || !selectedProfile || testing}
              size="large"
            >
              Send Connection
            </Button>
            <Button
              variant="contained"
              color="info"
              startIcon={<PlayArrow />}
              onClick={() => runTest('message')}
              disabled={!selectedLead || !selectedProfile || testing}
              size="large"
            >
              Send Message
            </Button>
            <Button
              variant="contained"
              color="warning"
              startIcon={<PlayArrow />}
              onClick={() => runTest('follow')}
              disabled={!selectedLead || !selectedProfile || testing}
              size="large"
            >
              Follow Profile
            </Button>
          </Stack>
        </Paper>

        {error && <Alert severity="error">{error}</Alert>}

        {runId && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} mb={2} color="error.main">
              Live Execution Logs
            </Typography>
            <LiveLogStream runId={runId} />
          </Paper>
        )}
      </Stack>

      <Snackbar open={showWarn} autoHideDuration={2500} onClose={() => setShowWarn(false)}>
        <Alert severity="warning" variant="filled" onClose={() => setShowWarn(false)} sx={{ width: '100%' }}>
          Please select both a lead and a LinkedIn profile
        </Alert>
      </Snackbar>
    </Box>
  );
}

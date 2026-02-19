'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  Grid,
  IconButton,
  Paper,
  Slider,
  Snackbar,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { Add, Delete, Edit, Save } from '@mui/icons-material';
import { createClient } from '@/lib/supabase/client';

interface Settings {
  id: string;
  daily_visit_limit: number;
  daily_connect_limit: number;
  daily_message_limit: number;
  daily_follow_limit: number;
  min_action_delay_sec: number;
  max_action_delay_sec: number;
  min_lead_delay_sec: number;
  max_lead_delay_sec: number;
  working_hours_enabled: boolean;
  working_hours_start: number;
  working_hours_end: number;
  skip_weekends: boolean;
  speed_multiplier: number;
}

interface LinkedInProfile {
  id: string;
  name: string;
  adspower_profile_id: string | null;
  status: string | null;
  linkedin_email: string | null;
  daily_visit_count: number | null;
  daily_connect_count: number | null;
  daily_message_count: number | null;
  last_run_at: string | null;
}

const DEFAULT_SETTINGS: Settings = {
  id: '',
  daily_visit_limit: 80,
  daily_connect_limit: 20,
  daily_message_limit: 15,
  daily_follow_limit: 30,
  min_action_delay_sec: 3,
  max_action_delay_sec: 12,
  min_lead_delay_sec: 10,
  max_lead_delay_sec: 30,
  working_hours_enabled: true,
  working_hours_start: 9,
  working_hours_end: 18,
  skip_weekends: true,
  speed_multiplier: 1,
};

function parseNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

function normalizeSettings(data: Record<string, unknown>): Settings {
  return {
    id: String(data.id ?? ''),
    daily_visit_limit: parseNumber(data.daily_visit_limit, DEFAULT_SETTINGS.daily_visit_limit),
    daily_connect_limit: parseNumber(data.daily_connect_limit, DEFAULT_SETTINGS.daily_connect_limit),
    daily_message_limit: parseNumber(data.daily_message_limit, DEFAULT_SETTINGS.daily_message_limit),
    daily_follow_limit: parseNumber(data.daily_follow_limit, DEFAULT_SETTINGS.daily_follow_limit),
    min_action_delay_sec: parseNumber(data.min_action_delay_sec, DEFAULT_SETTINGS.min_action_delay_sec),
    max_action_delay_sec: parseNumber(data.max_action_delay_sec, DEFAULT_SETTINGS.max_action_delay_sec),
    min_lead_delay_sec: parseNumber(data.min_lead_delay_sec, DEFAULT_SETTINGS.min_lead_delay_sec),
    max_lead_delay_sec: parseNumber(data.max_lead_delay_sec, DEFAULT_SETTINGS.max_lead_delay_sec),
    working_hours_enabled: Boolean(data.working_hours_enabled ?? DEFAULT_SETTINGS.working_hours_enabled),
    working_hours_start: parseNumber(data.working_hours_start, DEFAULT_SETTINGS.working_hours_start),
    working_hours_end: parseNumber(data.working_hours_end, DEFAULT_SETTINGS.working_hours_end),
    skip_weekends: Boolean(data.skip_weekends ?? DEFAULT_SETTINGS.skip_weekends),
    speed_multiplier: parseNumber(data.speed_multiplier, DEFAULT_SETTINGS.speed_multiplier),
  };
}

function parseIntegerInput(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function SettingsPage() {
  const supabase = createClient();
  const [tab, setTab] = useState(0);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [profiles, setProfiles] = useState<LinkedInProfile[]>([]);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    const [settingsRes, profilesRes] = await Promise.all([
      supabase.from('app_settings').select('*').limit(1).maybeSingle(),
      supabase.from('linkedin_profiles').select('*').order('created_at', { ascending: true }),
    ]);

    if (settingsRes.error) {
      setError(settingsRes.error.message);
      return;
    }

    if (settingsRes.data) {
      setSettings(normalizeSettings(settingsRes.data as Record<string, unknown>));
    }

    if (profilesRes.error) {
      setError(profilesRes.error.message);
      return;
    }

    setProfiles((profilesRes.data ?? []) as LinkedInProfile[]);
    setError('');
  };

  useEffect(() => {
    void loadData();
  }, []);

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!settings.id) {
      setError('Settings row not found. Initialize app_settings first.');
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      daily_visit_limit: settings.daily_visit_limit,
      daily_connect_limit: settings.daily_connect_limit,
      daily_message_limit: settings.daily_message_limit,
      daily_follow_limit: settings.daily_follow_limit,
      min_action_delay_sec: settings.min_action_delay_sec,
      max_action_delay_sec: settings.max_action_delay_sec,
      min_lead_delay_sec: settings.min_lead_delay_sec,
      max_lead_delay_sec: settings.max_lead_delay_sec,
      working_hours_enabled: settings.working_hours_enabled,
      working_hours_start: settings.working_hours_start,
      working_hours_end: settings.working_hours_end,
      skip_weekends: settings.skip_weekends,
      speed_multiplier: settings.speed_multiplier,
    };

    const { error: saveError } = await supabase.from('app_settings').update(payload).eq('id', settings.id);

    if (saveError) {
      setError(saveError.message);
    } else {
      setShowSuccess(true);
    }

    setSaving(false);
  };

  const deleteProfile = async (profileId: string) => {
    if (!window.confirm('Delete this LinkedIn profile?')) {
      return;
    }

    const response = await fetch(`/api/profiles/${profileId}`, { method: 'DELETE' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError((payload.error as string) || 'Failed to delete profile');
      return;
    }

    setProfiles((prev) => prev.filter((profile) => profile.id !== profileId));
  };

  return (
    <Box sx={{ p: 4, maxWidth: 1200 }} data-animate="page">
      <Typography variant="h4" fontWeight={600} mb={4}>
        Settings
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, nextTab) => setTab(nextTab)} sx={{ mb: 4 }}>
        <Tab label="Automation Limits" />
        <Tab label="Timing & Speed" />
        <Tab label="Working Hours" />
        <Tab label="Manage Profiles" />
      </Tabs>

      {tab === 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} mb={3} color="primary.main">
            Daily Limits
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Profile Visits per Day"
                type="number"
                value={settings.daily_visit_limit}
                onChange={(event) =>
                  updateSetting('daily_visit_limit', parseIntegerInput(event.target.value, settings.daily_visit_limit))
                }
                fullWidth
                helperText="Safe limit: 80-100"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Connection Requests per Day"
                type="number"
                value={settings.daily_connect_limit}
                onChange={(event) =>
                  updateSetting('daily_connect_limit', parseIntegerInput(event.target.value, settings.daily_connect_limit))
                }
                fullWidth
                helperText="Safe limit: 15-25"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Messages per Day"
                type="number"
                value={settings.daily_message_limit}
                onChange={(event) =>
                  updateSetting('daily_message_limit', parseIntegerInput(event.target.value, settings.daily_message_limit))
                }
                fullWidth
                helperText="Safe limit: 10-20"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Follows per Day"
                type="number"
                value={settings.daily_follow_limit}
                onChange={(event) =>
                  updateSetting('daily_follow_limit', parseIntegerInput(event.target.value, settings.daily_follow_limit))
                }
                fullWidth
                helperText="Safe limit: 25-40"
              />
            </Grid>
          </Grid>
        </Paper>
      )}

      {tab === 1 && (
        <Stack spacing={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} mb={3} color="success.main">
              Speed Multiplier
            </Typography>
            <Alert severity="info" sx={{ mb: 3 }}>
              Lower values are safer but slower. Higher values are faster but increase risk.
            </Alert>
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Current speed: <strong>{settings.speed_multiplier.toFixed(1)}x</strong>
              </Typography>
              <Slider
                value={settings.speed_multiplier}
                onChange={(_, value) => {
                  const nextValue = Array.isArray(value) ? value[0] : value;
                  updateSetting('speed_multiplier', Number(nextValue.toFixed(1)));
                }}
                min={0.5}
                max={3}
                step={0.1}
                marks={[
                  { value: 0.5, label: '0.5x Safe' },
                  { value: 1, label: '1.0x Normal' },
                  { value: 2, label: '2.0x Fast' },
                  { value: 3, label: '3.0x Risky' },
                ]}
                valueLabelDisplay="auto"
              />
            </Stack>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} mb={3} color="success.main">
              Action Delays (Base)
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Effective delays are divided by speed multiplier ({settings.speed_multiplier.toFixed(1)}x)
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Min Action Delay (seconds)"
                  type="number"
                  value={settings.min_action_delay_sec}
                  onChange={(event) =>
                    updateSetting(
                      'min_action_delay_sec',
                      parseIntegerInput(event.target.value, settings.min_action_delay_sec)
                    )
                  }
                  fullWidth
                  helperText="Delay between clicks/actions"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Max Action Delay (seconds)"
                  type="number"
                  value={settings.max_action_delay_sec}
                  onChange={(event) =>
                    updateSetting(
                      'max_action_delay_sec',
                      parseIntegerInput(event.target.value, settings.max_action_delay_sec)
                    )
                  }
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Min Lead Delay (seconds)"
                  type="number"
                  value={settings.min_lead_delay_sec}
                  onChange={(event) =>
                    updateSetting('min_lead_delay_sec', parseIntegerInput(event.target.value, settings.min_lead_delay_sec))
                  }
                  fullWidth
                  helperText="Delay between processing leads"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Max Lead Delay (seconds)"
                  type="number"
                  value={settings.max_lead_delay_sec}
                  onChange={(event) =>
                    updateSetting('max_lead_delay_sec', parseIntegerInput(event.target.value, settings.max_lead_delay_sec))
                  }
                  fullWidth
                />
              </Grid>
            </Grid>
          </Paper>
        </Stack>
      )}

      {tab === 2 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} mb={3} color="warning.main">
            Working Hours
          </Typography>
          <Stack spacing={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.working_hours_enabled}
                  onChange={(event) => updateSetting('working_hours_enabled', event.target.checked)}
                  color="warning"
                />
              }
              label="Enable working hours restriction (Bangladesh time)"
            />

            {settings.working_hours_enabled && (
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Start Hour (24h format)"
                    type="number"
                    value={settings.working_hours_start}
                    onChange={(event) =>
                      updateSetting('working_hours_start', parseIntegerInput(event.target.value, settings.working_hours_start))
                    }
                    fullWidth
                    helperText="e.g., 9 for 9 AM"
                    inputProps={{ min: 0, max: 23 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="End Hour (24h format)"
                    type="number"
                    value={settings.working_hours_end}
                    onChange={(event) =>
                      updateSetting('working_hours_end', parseIntegerInput(event.target.value, settings.working_hours_end))
                    }
                    fullWidth
                    helperText="e.g., 18 for 6 PM"
                    inputProps={{ min: 0, max: 23 }}
                  />
                </Grid>
              </Grid>
            )}

            <FormControlLabel
              control={
                <Switch
                  checked={settings.skip_weekends}
                  onChange={(event) => updateSetting('skip_weekends', event.target.checked)}
                  color="warning"
                />
              }
              label="Skip automation on weekends"
            />
          </Stack>
        </Paper>
      )}

      {tab === 3 && (
        <Paper sx={{ p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h6" fontWeight={600} color="error.main">
              LinkedIn Profiles
            </Typography>
            <Button component={Link} href="/settings/profiles" startIcon={<Add />} variant="contained">
              Add Profile
            </Button>
          </Stack>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>AdsPower ID</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Today's Activity</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Last Run</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {profiles.map((profile) => (
                  <TableRow key={profile.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {profile.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={profile.adspower_profile_id || '—'} size="small" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{profile.linkedin_email || '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Chip label={`V: ${profile.daily_visit_count ?? 0}`} size="small" color="info" />
                        <Chip label={`C: ${profile.daily_connect_count ?? 0}`} size="small" color="success" />
                        <Chip label={`M: ${profile.daily_message_count ?? 0}`} size="small" color="warning" />
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={profile.status || 'unknown'}
                        size="small"
                        color={profile.status === 'idle' ? 'default' : 'info'}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {profile.last_run_at ? new Date(profile.last_run_at).toLocaleString() : 'Never'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <IconButton component={Link} href={`/settings/profiles/${profile.id}`} size="small" color="primary">
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => void deleteProfile(profile.id)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {!profiles.length && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                        No profiles found. Add one from the button above.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {tab !== 3 && (
        <Stack direction="row" justifyContent="flex-end" spacing={2} sx={{ mt: 4 }}>
          <Button variant="contained" size="large" startIcon={<Save />} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </Stack>
      )}

      <Snackbar open={showSuccess} autoHideDuration={3000} onClose={() => setShowSuccess(false)}>
        <Alert severity="success" variant="filled" onClose={() => setShowSuccess(false)} sx={{ width: '100%' }}>
          Settings saved successfully
        </Alert>
      </Snackbar>
    </Box>
  );
}

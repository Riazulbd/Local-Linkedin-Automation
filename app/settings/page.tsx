'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  Grid,
  Paper,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { Save } from '@mui/icons-material';
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
};

export default function SettingsPage() {
  const supabase = createClient();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadSettings = async () => {
      const { data, error: loadError } = await supabase.from('app_settings').select('*').limit(1).maybeSingle();

      if (!mounted) return;
      if (loadError) {
        setError(loadError.message);
        return;
      }

      if (!data) return;

      setSettings({
        id: String(data.id ?? ''),
        daily_visit_limit: Number(data.daily_visit_limit ?? DEFAULT_SETTINGS.daily_visit_limit),
        daily_connect_limit: Number(data.daily_connect_limit ?? DEFAULT_SETTINGS.daily_connect_limit),
        daily_message_limit: Number(data.daily_message_limit ?? DEFAULT_SETTINGS.daily_message_limit),
        daily_follow_limit: Number(data.daily_follow_limit ?? DEFAULT_SETTINGS.daily_follow_limit),
        min_action_delay_sec: Number(data.min_action_delay_sec ?? DEFAULT_SETTINGS.min_action_delay_sec),
        max_action_delay_sec: Number(data.max_action_delay_sec ?? DEFAULT_SETTINGS.max_action_delay_sec),
        min_lead_delay_sec: Number(data.min_lead_delay_sec ?? DEFAULT_SETTINGS.min_lead_delay_sec),
        max_lead_delay_sec: Number(data.max_lead_delay_sec ?? DEFAULT_SETTINGS.max_lead_delay_sec),
        working_hours_enabled: Boolean(data.working_hours_enabled ?? DEFAULT_SETTINGS.working_hours_enabled),
        working_hours_start: Number(data.working_hours_start ?? DEFAULT_SETTINGS.working_hours_start),
        working_hours_end: Number(data.working_hours_end ?? DEFAULT_SETTINGS.working_hours_end),
        skip_weekends: Boolean(data.skip_weekends ?? DEFAULT_SETTINGS.skip_weekends),
      });
    };

    void loadSettings();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  const canSave = useMemo(() => Boolean(settings.id), [settings.id]);

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const parseNumber = (value: string, fallback: number): number => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
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
    };

    const { error: saveError } = await supabase.from('app_settings').update(payload).eq('id', settings.id);

    if (saveError) {
      setError(saveError.message);
    } else {
      setShowSuccess(true);
    }

    setSaving(false);
  };

  return (
    <Box sx={{ p: 4, maxWidth: 900 }} data-animate="page">
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4} spacing={2}>
        <Typography variant="h4" fontWeight={600}>
          Settings
        </Typography>
        <Button component={Link} href="/settings/profiles" variant="outlined" color="info">
          Manage Profiles
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Stack spacing={4}>
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
                  updateSetting('daily_visit_limit', parseNumber(event.target.value, settings.daily_visit_limit))
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
                  updateSetting('daily_connect_limit', parseNumber(event.target.value, settings.daily_connect_limit))
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
                  updateSetting('daily_message_limit', parseNumber(event.target.value, settings.daily_message_limit))
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
                  updateSetting('daily_follow_limit', parseNumber(event.target.value, settings.daily_follow_limit))
                }
                fullWidth
                helperText="Safe limit: 25-40"
              />
            </Grid>
          </Grid>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} mb={3} color="success.main">
            Timing & Delays
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
                    parseNumber(event.target.value, settings.min_action_delay_sec)
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
                    parseNumber(event.target.value, settings.max_action_delay_sec)
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
                  updateSetting('min_lead_delay_sec', parseNumber(event.target.value, settings.min_lead_delay_sec))
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
                  updateSetting('max_lead_delay_sec', parseNumber(event.target.value, settings.max_lead_delay_sec))
                }
                fullWidth
              />
            </Grid>
          </Grid>
        </Paper>

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
                      updateSetting('working_hours_start', parseNumber(event.target.value, settings.working_hours_start))
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
                      updateSetting('working_hours_end', parseNumber(event.target.value, settings.working_hours_end))
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

        <Stack direction="row" justifyContent="flex-end" spacing={2}>
          <Button
            variant="contained"
            size="large"
            startIcon={<Save />}
            onClick={handleSave}
            disabled={saving || !canSave}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </Stack>
      </Stack>

      <Snackbar open={showSuccess} autoHideDuration={3000} onClose={() => setShowSuccess(false)}>
        <Alert severity="success" variant="filled" onClose={() => setShowSuccess(false)} sx={{ width: '100%' }}>
          Settings saved successfully
        </Alert>
      </Snackbar>
    </Box>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
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
import {
  Add,
  Delete,
  Edit,
  Refresh,
  Save,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
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
  openrouter_api_key: string;
  primary_ai_model: string;
  fallback_ai_model: string;
  vision_ai_model: string;
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

interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  context_length: number | null;
  prompt_pricing: number | null;
  completion_pricing: number | null;
  raw_pricing?: Record<string, unknown>;
}

interface UsageTotals {
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

interface UsageModelBreakdown extends UsageTotals {
  model: string;
}

interface UsageSummary {
  all_time: {
    totals: UsageTotals;
    per_model: UsageModelBreakdown[];
  };
  session: {
    totals: UsageTotals;
    per_model: UsageModelBreakdown[];
  };
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
  openrouter_api_key: '',
  primary_ai_model: '',
  fallback_ai_model: '',
  vision_ai_model: 'openai/gpt-4o-mini',
};

const EMPTY_USAGE: UsageSummary = {
  all_time: {
    totals: { calls: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0 },
    per_model: [],
  },
  session: {
    totals: { calls: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0 },
    per_model: [],
  },
};

function parseNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function parseString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
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
    openrouter_api_key: parseString(data.openrouter_api_key, ''),
    primary_ai_model: parseString(data.primary_ai_model, ''),
    fallback_ai_model: parseString(data.fallback_ai_model, ''),
    vision_ai_model: parseString(data.vision_ai_model, DEFAULT_SETTINGS.vision_ai_model),
  };
}

function parseIntegerInput(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatUsd(value: number): string {
  return `$${value.toFixed(6)}`;
}

export default function SettingsPage() {
  const supabase = createClient();
  const sessionStartedAt = useMemo(() => new Date().toISOString(), []);

  const [tab, setTab] = useState(0);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [profiles, setProfiles] = useState<LinkedInProfile[]>([]);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');

  const [showApiKey, setShowApiKey] = useState(false);
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState('');

  const [usageSummary, setUsageSummary] = useState<UsageSummary>(EMPTY_USAGE);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState('');

  const loadUsageSummary = async () => {
    setUsageLoading(true);
    setUsageError('');
    try {
      const response = await fetch(
        `/api/settings/openrouter/usage?sessionSince=${encodeURIComponent(sessionStartedAt)}`,
        { cache: 'no-store' }
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error((payload.error as string) || 'Failed to load AI usage summary');
      }

      setUsageSummary((payload as UsageSummary) ?? EMPTY_USAGE);
    } catch (usageLoadError) {
      setUsageError(usageLoadError instanceof Error ? usageLoadError.message : 'Failed to load usage summary');
      setUsageSummary(EMPTY_USAGE);
    } finally {
      setUsageLoading(false);
    }
  };

  const loadModels = async (apiKeyOverride?: string) => {
    setModelsLoading(true);
    setModelsError('');
    try {
      const response = await fetch('/api/settings/openrouter/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKeyOverride }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error((payload.error as string) || 'Failed to load OpenRouter models');
      }

      const nextModels = Array.isArray((payload as { models?: unknown[] }).models)
        ? ((payload as { models: OpenRouterModel[] }).models ?? [])
        : [];
      setModels(nextModels);
    } catch (modelLoadError) {
      setModelsError(modelLoadError instanceof Error ? modelLoadError.message : 'Failed to load OpenRouter models');
      setModels([]);
    } finally {
      setModelsLoading(false);
    }
  };

  const loadData = async () => {
    const [settingsRes, profilesRes] = await Promise.all([
      supabase.from('app_settings').select('*').limit(1).maybeSingle(),
      supabase.from('linkedin_profiles').select('*').order('created_at', { ascending: true }),
    ]);

    if (settingsRes.error) {
      setError(settingsRes.error.message);
      return;
    }

    let normalized = DEFAULT_SETTINGS;
    if (settingsRes.data) {
      normalized = normalizeSettings(settingsRes.data as Record<string, unknown>);
      setSettings(normalized);
    }

    if (profilesRes.error) {
      setError(profilesRes.error.message);
      return;
    }

    setProfiles((profilesRes.data ?? []) as LinkedInProfile[]);
    setError('');

    if (normalized.openrouter_api_key) {
      await loadModels(normalized.openrouter_api_key);
    }

    await loadUsageSummary();
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
      openrouter_api_key: settings.openrouter_api_key || null,
      primary_ai_model: settings.primary_ai_model || null,
      fallback_ai_model: settings.fallback_ai_model || null,
      vision_ai_model: settings.vision_ai_model || 'openai/gpt-4o-mini',
    };

    const { error: saveError } = await supabase.from('app_settings').update(payload).eq('id', settings.id);

    if (saveError) {
      setError(saveError.message);
    } else {
      setShowSuccess(true);
      if (settings.openrouter_api_key) {
        await loadModels(settings.openrouter_api_key);
      }
      await loadUsageSummary();
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

  const selectedPrimaryModel = useMemo(
    () => models.find((model) => model.id === settings.primary_ai_model) ?? null,
    [models, settings.primary_ai_model]
  );

  const estimatedCostPer1000Profiles = useMemo(() => {
    if (!selectedPrimaryModel) return null;
    if (selectedPrimaryModel.prompt_pricing == null || selectedPrimaryModel.completion_pricing == null) return null;

    const calls = usageSummary.all_time.totals.calls || 0;
    const avgInput = calls > 0 ? usageSummary.all_time.totals.input_tokens / calls : 700;
    const avgOutput = calls > 0 ? usageSummary.all_time.totals.output_tokens / calls : 120;

    const perProfile =
      avgInput * selectedPrimaryModel.prompt_pricing + avgOutput * selectedPrimaryModel.completion_pricing;

    if (!Number.isFinite(perProfile)) return null;
    return perProfile * 1000;
  }, [selectedPrimaryModel, usageSummary]);

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
        <Tab label="AI / OpenRouter" />
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
        <Stack spacing={3}>
          <Paper sx={{ p: 3 }}>
            <Stack spacing={2.5}>
              <Typography variant="h6" fontWeight={600} color="info.main">
                OpenRouter API
              </Typography>
              <TextField
                label="OpenRouter API Key"
                type={showApiKey ? 'text' : 'password'}
                value={settings.openrouter_api_key}
                onChange={(event) => updateSetting('openrouter_api_key', event.target.value)}
                fullWidth
                placeholder="sk-or-v1-..."
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        edge="end"
                        onClick={() => setShowApiKey((prev) => !prev)}
                        aria-label="toggle OpenRouter API key visibility"
                      >
                        {showApiKey ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Stack direction="row" spacing={1.5} alignItems="center">
                <Button
                  variant="outlined"
                  startIcon={modelsLoading ? <CircularProgress size={16} /> : <Refresh />}
                  onClick={() => void loadModels(settings.openrouter_api_key)}
                  disabled={!settings.openrouter_api_key || modelsLoading}
                >
                  {modelsLoading ? 'Fetching Models...' : 'Fetch Models'}
                </Button>
                <Typography variant="caption" color="text.secondary">
                  Models are loaded from OpenRouter `/api/v1/models`.
                </Typography>
              </Stack>

              {modelsError && <Alert severity="error">{modelsError}</Alert>}

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Autocomplete
                    options={models}
                    loading={modelsLoading}
                    value={models.find((model) => model.id === settings.primary_ai_model) ?? null}
                    onChange={(_, model) => updateSetting('primary_ai_model', model?.id ?? '')}
                    getOptionLabel={(option) => `${option.name} (${option.id})`}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    renderInput={(params) => <TextField {...params} label="Primary AI Model" />}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Autocomplete
                    options={models}
                    loading={modelsLoading}
                    value={models.find((model) => model.id === settings.fallback_ai_model) ?? null}
                    onChange={(_, model) => updateSetting('fallback_ai_model', model?.id ?? '')}
                    getOptionLabel={(option) => `${option.name} (${option.id})`}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    renderInput={(params) => <TextField {...params} label="Fallback AI Model" />}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    select
                    fullWidth
                    label="Vision Model"
                    value={settings.vision_ai_model || 'openai/gpt-4o-mini'}
                    onChange={(event) => updateSetting('vision_ai_model', event.target.value)}
                    helperText="Used for screenshot-based profile analysis"
                  >
                    <MenuItem value="openai/gpt-4o-mini">
                      GPT-4o Mini — Recommended ($0.001/profile)
                    </MenuItem>
                    <MenuItem value="openai/gpt-4o">
                      GPT-4o — Most Accurate ($0.004/profile)
                    </MenuItem>
                    <MenuItem value="google/gemini-flash-1.5">
                      Gemini Flash 1.5 — Cheapest ($0.0005/profile)
                    </MenuItem>
                    <MenuItem value="anthropic/claude-3-5-haiku">
                      Claude 3.5 Haiku ($0.002/profile)
                    </MenuItem>
                  </TextField>
                </Grid>
              </Grid>
            </Stack>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" fontWeight={600} color="secondary.main">
                AI Usage & Cost Dashboard
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={usageLoading ? <CircularProgress size={14} /> : <Refresh />}
                onClick={() => void loadUsageSummary()}
                disabled={usageLoading}
              >
                Refresh
              </Button>
            </Stack>

            {usageError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {usageError}
              </Alert>
            )}

            <Grid container spacing={2} mb={2.5}>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Session Usage
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Input tokens: <strong>{usageSummary.session.totals.input_tokens.toLocaleString()}</strong>
                  </Typography>
                  <Typography variant="body2">
                    Output tokens: <strong>{usageSummary.session.totals.output_tokens.toLocaleString()}</strong>
                  </Typography>
                  <Typography variant="body2">
                    Total cost: <strong>{formatUsd(usageSummary.session.totals.cost_usd)}</strong>
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    All-time Usage
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Input tokens: <strong>{usageSummary.all_time.totals.input_tokens.toLocaleString()}</strong>
                  </Typography>
                  <Typography variant="body2">
                    Output tokens: <strong>{usageSummary.all_time.totals.output_tokens.toLocaleString()}</strong>
                  </Typography>
                  <Typography variant="body2">
                    Total cost: <strong>{formatUsd(usageSummary.all_time.totals.cost_usd)}</strong>
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            <Paper variant="outlined" sx={{ p: 2, mb: 2.5 }}>
              <Typography variant="subtitle2" color="text.secondary" mb={1}>
                Estimated Cost per 1000 Profiles (Primary Model)
              </Typography>
              <Typography variant="body2">
                Model: <strong>{selectedPrimaryModel?.id || 'Not selected'}</strong>
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                Estimated cost: <strong>{estimatedCostPer1000Profiles == null ? 'N/A' : formatUsd(estimatedCostPer1000Profiles)}</strong>
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                Estimate uses all-time average tokens per AI call and OpenRouter model pricing from `/api/v1/models`.
              </Typography>
            </Paper>

            <Typography variant="subtitle2" color="text.secondary" mb={1}>
              Per-model Breakdown
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Model</TableCell>
                    <TableCell align="right">Calls</TableCell>
                    <TableCell align="right">Input</TableCell>
                    <TableCell align="right">Output</TableCell>
                    <TableCell align="right">Cost (USD)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {usageSummary.all_time.per_model.map((row) => (
                    <TableRow key={row.model}>
                      <TableCell sx={{ maxWidth: 420, wordBreak: 'break-word' }}>{row.model}</TableCell>
                      <TableCell align="right">{row.calls.toLocaleString()}</TableCell>
                      <TableCell align="right">{row.input_tokens.toLocaleString()}</TableCell>
                      <TableCell align="right">{row.output_tokens.toLocaleString()}</TableCell>
                      <TableCell align="right">{formatUsd(row.cost_usd)}</TableCell>
                    </TableRow>
                  ))}
                  {!usageSummary.all_time.per_model.length && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography variant="body2" color="text.secondary" sx={{ py: 1.5, textAlign: 'center' }}>
                          No AI usage logs yet.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Stack>
      )}

      {tab === 3 && (
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

      {tab === 4 && (
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

      {tab !== 4 && (
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

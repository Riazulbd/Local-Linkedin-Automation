'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  Typography,
} from '@mui/material';
import { CampaignStepEditor } from '@/components/campaigns/CampaignStepEditor';
import { CampaignStatusBadge } from '@/components/campaigns/CampaignStatusBadge';
import { useCampaignContext } from '@/lib/context/CampaignContext';
import type { CampaignStep, LeadFolder, LinkedInProfile } from '@/types';

function normalizeStep(step: CampaignStep, index: number): CampaignStep {
  const type = step.step_type ?? step.type ?? 'visit_profile';
  return {
    ...step,
    step_type: type,
    type,
    step_order: index,
    order: index,
    config: step.config ?? {},
  };
}

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const campaignId = String(params?.id || '');

  const {
    campaigns,
    steps,
    selectCampaign,
    setSteps,
    updateStep,
    addStep,
    removeStep,
    refreshCampaigns,
    updateCampaign,
    startCampaign,
    stopCampaign,
  } = useCampaignContext();

  const campaign = campaigns.find((entry) => entry.id === campaignId) ?? null;

  const [profiles, setProfiles] = useState<LinkedInProfile[]>([]);
  const [folders, setFolders] = useState<LeadFolder[]>([]);
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [dailyNewLeads, setDailyNewLeads] = useState(10);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    refreshCampaigns().catch(() => undefined);
  }, [refreshCampaigns]);

  useEffect(() => {
    if (!campaignId) return;
    selectCampaign(campaignId);
  }, [campaignId, selectCampaign]);

  useEffect(() => {
    if (!campaign) return;

    const campaignSteps = campaign.steps ?? campaign.sequence ?? [];
    setSteps(campaignSteps.map((step, index) => normalizeStep(step, index)));
    setSelectedProfileIds(campaign.profiles ?? campaign.profile_ids ?? []);
    setSelectedFolderId(campaign.folder_id || '');
    setDailyNewLeads(campaign.daily_new_leads || 10);
  }, [campaign, setSteps]);

  useEffect(() => {
    let mounted = true;
    async function loadOptions() {
      try {
        const [profileRes, folderRes] = await Promise.all([
          fetch('/api/profiles', { cache: 'no-store' }),
          fetch('/api/lead-folders', { cache: 'no-store' }),
        ]);

        const profilePayload = await profileRes.json().catch(() => ({}));
        const folderPayload = await folderRes.json().catch(() => ({}));

        if (!profileRes.ok) throw new Error(profilePayload.error || 'Failed to load profiles');
        if (!folderRes.ok) throw new Error(folderPayload.error || 'Failed to load folders');

        if (!mounted) return;
        setProfiles(profilePayload.profiles ?? []);
        setFolders(folderPayload.folders ?? []);
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load campaign options');
      }
    }

    void loadOptions();
    return () => {
      mounted = false;
    };
  }, []);

  const orderedSteps = useMemo(() => steps.map((step, index) => normalizeStep(step, index)), [steps]);

  function toggleProfile(profileId: string) {
    setSelectedProfileIds((prev) =>
      prev.includes(profileId) ? prev.filter((id) => id !== profileId) : [...prev, profileId]
    );
  }

  function moveStep(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= orderedSteps.length) return;
    const next = [...orderedSteps];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setSteps(next.map((step, index) => normalizeStep(step, index)));
  }

  async function saveCampaign() {
    if (!campaign) return;

    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateCampaign(campaign.id, {
        steps: orderedSteps,
        sequence: orderedSteps,
        profile_ids: selectedProfileIds,
        profiles: selectedProfileIds,
        folder_id: selectedFolderId || null,
        daily_new_leads: dailyNewLeads,
      });
      await refreshCampaigns();
      setMessage('Campaign updated');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save campaign');
    } finally {
      setIsSaving(false);
    }
  }

  if (!campaign) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography variant="body2" color="text.secondary">
          Campaign not found or still loading.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }} data-animate="page">
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3} spacing={2}>
        <Box>
          <Button component={Link} href="/campaigns" variant="text" sx={{ px: 0, mb: 0.5 }}>
            Back to campaigns
          </Button>
          <Typography variant="h4" fontWeight={600}>
            {campaign.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {campaign.description || 'No description'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <CampaignStatusBadge status={campaign.status} />
          <Button size="small" color="success" variant="outlined" onClick={() => startCampaign(campaign.id).catch(() => undefined)}>
            Activate
          </Button>
          <Button size="small" color="warning" variant="outlined" onClick={() => stopCampaign(campaign.id).catch(() => undefined)}>
            Pause
          </Button>
          <Button
            size="small"
            color="inherit"
            variant="outlined"
            onClick={() => updateCampaign(campaign.id, { status: 'archived' }).catch(() => undefined)}
          >
            Archive
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {message && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {message}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
          <Typography variant="h6">Step Builder</Typography>
          <Button variant="outlined" onClick={() => addStep('visit_profile')}>
            Add Step
          </Button>
        </Stack>

        <Stack spacing={1.5}>
          {orderedSteps.map((step, index) => (
            <Box key={step.id}>
              <CampaignStepEditor
                step={step}
                onChange={(updated) => updateStep(index, updated)}
                onDelete={orderedSteps.length > 1 ? () => removeStep(index) : undefined}
              />
              <Stack direction="row" spacing={1} mt={1}>
                <Button size="small" variant="text" onClick={() => moveStep(index, index - 1)}>
                  Move Up
                </Button>
                <Button size="small" variant="text" onClick={() => moveStep(index, index + 1)}>
                  Move Down
                </Button>
              </Stack>
            </Box>
          ))}
        </Stack>
      </Paper>

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}>
        <Paper sx={{ p: 3, flex: 1 }}>
          <Typography variant="h6" mb={1.5}>
            Attached Profiles
          </Typography>
          <Stack spacing={1}>
            {profiles.map((profile) => (
              <Box key={profile.id}>
                <Stack direction="row" alignItems="center">
                  <Checkbox checked={selectedProfileIds.includes(profile.id)} onChange={() => toggleProfile(profile.id)} />
                  <Typography variant="body2">{profile.name}</Typography>
                </Stack>
              </Box>
            ))}
            {!profiles.length && (
              <Typography variant="body2" color="text.secondary">
                No profiles found.
              </Typography>
            )}
          </Stack>
        </Paper>

        <Paper sx={{ p: 3, flex: 1 }}>
          <Typography variant="h6" mb={1.5}>
            Execution Settings
          </Typography>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Lead Source Folder</InputLabel>
            <Select value={selectedFolderId} label="Lead Source Folder" onChange={(event) => setSelectedFolderId(String(event.target.value))}>
              <MenuItem value="">None</MenuItem>
              {folders.map((folder) => (
                <MenuItem key={folder.id} value={folder.id}>
                  {folder.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Typography variant="body2" color="text.secondary" mb={1}>
            Daily New Leads: <strong>{dailyNewLeads}</strong>
          </Typography>
          <Slider
            min={1}
            max={100}
            value={dailyNewLeads}
            onChange={(_, value) => setDailyNewLeads(Array.isArray(value) ? value[0] : value)}
            sx={{ mb: 2 }}
          />

          <Button type="button" variant="contained" onClick={() => saveCampaign().catch(() => undefined)} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Campaign'}
          </Button>
        </Paper>
      </Stack>
    </Box>
  );
}

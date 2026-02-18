'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { AddCircleOutlineRounded } from '@mui/icons-material';
import type { CampaignStep, CreateCampaignInput, LeadFolder, LinkedInProfile } from '@/types';
import { buildDefaultCampaignSequence } from '@/lib/logic/campaign.logic';
import { CampaignStepEditor } from './CampaignStepEditor';

interface CampaignBuilderProps {
  onSubmit: (input: CreateCampaignInput) => Promise<void>;
  initialName?: string;
}

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

export function CampaignBuilder({ onSubmit, initialName = '' }: CampaignBuilderProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState('');
  const [dailyNewLeads, setDailyNewLeads] = useState(20);
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [folderId, setFolderId] = useState('');
  const [steps, setSteps] = useState<CampaignStep[]>(() => buildDefaultCampaignSequence());
  const [profiles, setProfiles] = useState<LinkedInProfile[]>([]);
  const [folders, setFolders] = useState<LeadFolder[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedProfilesCount = useMemo(() => selectedProfileIds.length, [selectedProfileIds]);

  useEffect(() => {
    let active = true;

    const loadOptions = async () => {
      setIsLoadingOptions(true);
      try {
        const [profilesRes, foldersRes] = await Promise.all([
          fetch('/api/profiles', { cache: 'no-store' }),
          fetch('/api/lead-folders', { cache: 'no-store' }),
        ]);
        const profilesPayload = await profilesRes.json().catch(() => ({}));
        const foldersPayload = await foldersRes.json().catch(() => ({}));

        if (!profilesRes.ok) throw new Error(profilesPayload.error || 'Failed to load profiles');
        if (!foldersRes.ok) throw new Error(foldersPayload.error || 'Failed to load folders');
        if (!active) return;

        setProfiles((profilesPayload.profiles ?? []) as LinkedInProfile[]);
        setFolders((foldersPayload.folders ?? []) as LeadFolder[]);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load campaign options');
      } finally {
        if (active) setIsLoadingOptions(false);
      }
    };

    void loadOptions();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Campaign name is required');
      return;
    }

    if (!selectedProfileIds.length) {
      setError('Select at least one profile');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        daily_new_leads: dailyNewLeads,
        folder_id: folderId.trim() || undefined,
        profile_ids: selectedProfileIds,
        steps: steps.map((step, index) => normalizeStep(step, index)),
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create campaign');
    } finally {
      setIsSubmitting(false);
    }
  }

  function addStep() {
    setSteps((prev) => [
      ...prev,
      {
        id: `step_${Date.now()}`,
        step_type: 'visit_profile',
        type: 'visit_profile',
        step_order: prev.length,
        order: prev.length,
        config: {},
      },
    ]);
  }

  function updateStep(index: number, updated: CampaignStep) {
    setSteps((prev) =>
      prev.map((step, idx) => (idx === index ? normalizeStep(updated, idx) : normalizeStep(step, idx)))
    );
  }

  function deleteStep(index: number) {
    setSteps((prev) => prev.filter((_, idx) => idx !== index).map((step, idx) => normalizeStep(step, idx)));
  }

  return (
    <Paper component="form" onSubmit={handleSubmit} sx={{ p: 3 }} data-animate="page">
      <Typography variant="h6" fontWeight={600} mb={2}>
        Create Campaign
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {isLoadingOptions && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Loading profiles and folders...
        </Alert>
      )}

      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            label="Campaign Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            fullWidth
          />
          <TextField
            label="Daily New Leads"
            type="number"
            inputProps={{ min: 1, max: 500 }}
            value={dailyNewLeads}
            onChange={(event) => setDailyNewLeads(Math.max(1, Number(event.target.value) || 20))}
            sx={{ minWidth: 220 }}
          />
        </Stack>

        <TextField
          label="Description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          multiline
          rows={2}
          fullWidth
        />

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <FormControl fullWidth>
            <InputLabel>Profiles</InputLabel>
            <Select
              multiple
              value={selectedProfileIds}
              label="Profiles"
              onChange={(event) => setSelectedProfileIds(event.target.value as string[])}
              renderValue={(selected) => `${selected.length} profile(s)`}
            >
              {profiles.map((profile) => (
                <MenuItem key={profile.id} value={profile.id}>
                  <Checkbox checked={selectedProfileIds.includes(profile.id)} />
                  <ListItemText primary={profile.name} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Lead Source Folder (optional)</InputLabel>
            <Select value={folderId} label="Lead Source Folder (optional)" onChange={(event) => setFolderId(String(event.target.value))}>
              <MenuItem value="">None</MenuItem>
              {folders.map((folder) => (
                <MenuItem key={folder.id} value={folder.id}>
                  {folder.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
            <Typography variant="subtitle2" color="text.secondary">
              Sequence Steps
            </Typography>
            <Button type="button" variant="outlined" startIcon={<AddCircleOutlineRounded />} onClick={addStep}>
              Add Step
            </Button>
          </Stack>
          <Stack spacing={1.5}>
            {steps.map((step, index) => (
              <CampaignStepEditor
                key={step.id}
                step={normalizeStep(step, index)}
                onChange={(updated) => updateStep(index, updated)}
                onDelete={steps.length > 1 ? () => deleteStep(index) : undefined}
              />
            ))}
          </Stack>
        </Box>

        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            Selected profiles: {selectedProfilesCount}
          </Typography>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Campaign'}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

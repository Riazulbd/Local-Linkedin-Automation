'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { LeadFolder, LinkedInProfile } from '@/types';

interface ProfilesPayload {
  profiles?: LinkedInProfile[];
  error?: string;
}

interface FoldersPayload {
  folders?: LeadFolder[];
  error?: string;
}

function AddSingleLeadContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetFolderId = searchParams.get('folderId')?.trim() || '';

  const [profiles, setProfiles] = useState<LinkedInProfile[]>([]);
  const [folders, setFolders] = useState<LeadFolder[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [folderId, setFolderId] = useState('');
  const [url, setUrl] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId]
  );

  const loadOptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profilesRes, foldersRes] = await Promise.all([
        fetch('/api/profiles', { cache: 'no-store' }),
        fetch('/api/lead-folders', { cache: 'no-store' }),
      ]);

      const profilesPayload = (await profilesRes.json().catch(() => ({}))) as ProfilesPayload;
      const foldersPayload = (await foldersRes.json().catch(() => ({}))) as FoldersPayload;

      if (!profilesRes.ok) {
        throw new Error(profilesPayload.error || 'Failed to load profiles');
      }

      const nextProfiles = profilesPayload.profiles ?? [];
      const nextFolders = foldersRes.ok ? foldersPayload.folders ?? [] : [];

      setProfiles(nextProfiles);
      setFolders(nextFolders);
      setSelectedProfileId((current) => {
        if (current && nextProfiles.some((profile) => profile.id === current)) return current;
        return nextProfiles[0]?.id ?? '';
      });
      setFolderId((current) => {
        if (current && nextFolders.some((folder) => folder.id === current)) return current;
        if (presetFolderId && nextFolders.some((folder) => folder.id === presetFolderId)) return presetFolderId;
        return '';
      });

      if (!foldersRes.ok) {
        setError(foldersPayload.error || 'Failed to load folders. You can still save without selecting one.');
      }
    } catch (loadError) {
      setProfiles([]);
      setFolders([]);
      setError(loadError instanceof Error ? loadError.message : 'Failed to load profiles and folders');
    } finally {
      setLoading(false);
    }
  }, [presetFolderId]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  const isValidLinkedInUrl = (input: string): boolean => {
    const candidate = input.trim();
    if (!candidate) return false;

    try {
      const parsed = new URL(candidate);
      return parsed.hostname.includes('linkedin.com') && parsed.pathname.includes('/in/');
    } catch {
      return false;
    }
  };

  async function saveLead() {
    setError(null);
    setSuccess(null);

    if (!selectedProfileId) {
      setError('Select a LinkedIn profile first.');
      return;
    }

    if (!isValidLinkedInUrl(url)) {
      setError('Enter a valid LinkedIn profile URL (example: https://www.linkedin.com/in/username/).');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: selectedProfileId,
          folder_id: folderId || undefined,
          linkedin_url: url.trim(),
          first_name: firstName.trim() || undefined,
          last_name: lastName.trim() || undefined,
          company: company.trim() || undefined,
          title: title.trim() || undefined,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to add lead');
      }

      setSuccess('Lead added successfully.');
      router.push('/leads');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to add lead');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box sx={{ p: 4, maxWidth: 900 }} data-animate="page">
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" fontWeight={600}>
            Add Single Lead
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create one lead manually for quick testing.
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Button component={Link} href="/leads/folders" variant="outlined">
            Manage Folders
          </Button>
          <Button component={Link} href="/leads" variant="outlined">
            Back to Leads
          </Button>
        </Stack>
      </Stack>

      {loading ? (
        <Alert severity="info">Loading profiles and folders...</Alert>
      ) : (
        <Stack spacing={3}>
          {profiles.length === 0 && (
            <Alert severity="warning">
              No LinkedIn profiles found. Create one first from{' '}
              <Link href="/settings/profiles">Settings → Profiles</Link>.
            </Alert>
          )}

          {error && (
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={() => loadOptions().catch(() => undefined)}>
                  Retry
                </Button>
              }
            >
              {error}
            </Alert>
          )}
          {success && <Alert severity="success">{success}</Alert>}

          <Paper sx={{ p: 3 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>LinkedIn Profile</InputLabel>
                  <Select
                    value={selectedProfileId}
                    onChange={(event) => setSelectedProfileId(String(event.target.value))}
                    label="LinkedIn Profile"
                  >
                    <MenuItem value="">Select profile</MenuItem>
                    {profiles.map((profile) => (
                      <MenuItem key={profile.id} value={profile.id}>
                        {profile.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Folder (optional)</InputLabel>
                  <Select
                    value={folderId}
                    onChange={(event) => setFolderId(String(event.target.value))}
                    label="Folder (optional)"
                  >
                    <MenuItem value="">No folder</MenuItem>
                    {folders.map((folder) => (
                      <MenuItem key={folder.id} value={folder.id}>
                        {folder.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  label="LinkedIn URL"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://www.linkedin.com/in/username/"
                  helperText="Required. Other fields can be left blank and enriched later."
                  fullWidth
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="First Name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  fullWidth
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Last Name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  fullWidth
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Company"
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                  fullWidth
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Job Title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  fullWidth
                />
              </Grid>
            </Grid>
          </Paper>

          {selectedProfile && (
            <Alert severity="info">
              Lead will be saved under profile <strong>{selectedProfile.name}</strong>.
            </Alert>
          )}

          <Stack direction="row" justifyContent="flex-end" spacing={2}>
            <Button variant="outlined" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={() => saveLead().catch(() => undefined)}
              disabled={saving || !selectedProfileId || !url.trim()}
            >
              {saving ? 'Saving...' : 'Add Lead'}
            </Button>
          </Stack>
        </Stack>
      )}
    </Box>
  );
}

export default function AddSingleLeadPage() {
  return (
    <Suspense fallback={<Box sx={{ p: 4 }}><Alert severity="info">Loading lead form...</Alert></Box>}>
      <AddSingleLeadContent />
    </Suspense>
  );
}

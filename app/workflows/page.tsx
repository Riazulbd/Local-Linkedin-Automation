'use client';

import Link from 'next/link';
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { WorkflowCanvas } from '@/components/canvas/WorkflowCanvas';
import { useProfileStore } from '@/store/profileStore';

export default function WorkflowsPage() {
  const profiles = useProfileStore((state) => state.profiles);
  const selectedProfile = useProfileStore((state) => state.selectedProfile);
  const selectProfileById = useProfileStore((state) => state.selectProfileById);

  return (
    <Box sx={{ p: 4 }} data-animate="page">
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
        mb={3}
        spacing={2}
      >
        <Stack spacing={0}>
          <Typography variant="h4" fontWeight={600}>
            Flow Builder
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Design visual automation workflows with drag-and-drop nodes.
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 260 }}>
            <InputLabel>Active Profile</InputLabel>
            <Select
              value={selectedProfile?.id ?? ''}
              label="Active Profile"
              onChange={(event) => {
                const value = String(event.target.value);
                selectProfileById(value ? value : null);
              }}
            >
              {profiles.length === 0 && (
                <MenuItem value="" disabled>
                  No profiles available
                </MenuItem>
              )}
              {profiles.map((profile) => (
                <MenuItem key={profile.id} value={profile.id}>
                  {profile.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button component={Link} href="/settings/profiles" variant="outlined">
            Manage Profiles
          </Button>
        </Stack>
      </Stack>

      <Paper sx={{ height: 'calc(100vh - 210px)', overflow: 'hidden', border: 1, borderColor: 'divider' }}>
        <WorkflowCanvas />
      </Paper>
    </Box>
  );
}

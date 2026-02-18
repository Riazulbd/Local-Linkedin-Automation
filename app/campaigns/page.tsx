'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import { Add, Delete, Edit, MoreVert, PlayArrow } from '@mui/icons-material';
import { StatusChip } from '@/components/ui/StatusChip';
import type { Campaign } from '@/types';

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/campaigns', { cache: 'no-store' })
      .then((response) => response.json().catch(() => ({})))
      .then((payload) => setCampaigns((payload.campaigns ?? []) as Campaign[]))
      .catch(() => setCampaigns([]));
  }, []);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, id: string) => {
    setAnchorEl(event.currentTarget);
    setSelectedCampaign(id);
  };

  const closeMenu = () => {
    setAnchorEl(null);
  };

  const handleDelete = async () => {
    if (!selectedCampaign) return;

    await fetch(`/api/campaigns/${selectedCampaign}`, { method: 'DELETE' });
    setCampaigns((prev) => prev.filter((campaign) => campaign.id !== selectedCampaign));
    closeMenu();
  };

  const handleStart = async () => {
    if (!selectedCampaign) return;
    await fetch(`/api/campaigns/${selectedCampaign}/start`, { method: 'POST' });
    closeMenu();
  };

  return (
    <Box sx={{ p: 4 }} data-animate="page">
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" fontWeight={600}>
            Campaigns
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            {campaigns.length} campaigns
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => router.push('/campaigns/new')}>
          New Campaign
        </Button>
      </Stack>

      {campaigns.length === 0 ? (
        <Card sx={{ textAlign: 'center', py: 8 }}>
          <CardContent>
            <Typography color="text.secondary" mb={2}>
              No campaigns yet
            </Typography>
            <Button variant="contained" onClick={() => router.push('/campaigns/new')}>
              Create your first campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {campaigns.map((campaign) => (
            <Card key={campaign.id} sx={{ cursor: 'pointer' }} onClick={() => router.push(`/campaigns/${campaign.id}`)}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box flex={1}>
                    <Stack direction="row" spacing={2} alignItems="center" mb={1}>
                      <Typography variant="h6" fontWeight={600}>
                        {campaign.name}
                      </Typography>
                      <StatusChip status={campaign.status} />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {campaign.sequence?.length ?? 0} steps · {campaign.profiles?.length ?? 0} profiles
                    </Typography>
                  </Box>
                  <IconButton
                    onClick={(event) => {
                      event.stopPropagation();
                      handleMenuOpen(event, campaign.id);
                    }}
                  >
                    <MoreVert />
                  </IconButton>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={closeMenu}>
        <MenuItem
          onClick={() => {
            if (selectedCampaign) {
              router.push(`/campaigns/${selectedCampaign}`);
            }
            closeMenu();
          }}
        >
          <Edit fontSize="small" sx={{ mr: 1 }} /> Open
        </MenuItem>
        <MenuItem onClick={handleStart}>
          <PlayArrow fontSize="small" sx={{ mr: 1 }} /> Start
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <Delete fontSize="small" sx={{ mr: 1 }} /> Delete
        </MenuItem>
      </Menu>
    </Box>
  );
}

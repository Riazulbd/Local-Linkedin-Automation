'use client';

import { useRouter } from 'next/navigation';
import { Box, Button, Stack, Typography } from '@mui/material';
import { CampaignBuilder } from '@/components/campaigns/CampaignBuilder';
import { useCampaignContext } from '@/lib/context/CampaignContext';

export default function NewCampaignPage() {
  const router = useRouter();
  const { createCampaign } = useCampaignContext();

  return (
    <Box sx={{ p: 4 }}>
      <Stack spacing={0} mb={3}>
        <Typography variant="h4" fontWeight={600}>
          Create Campaign
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Define sequence steps, target folder, and profile mappings.
        </Typography>
        <Stack direction="row" spacing={1.5} mt={1.5}>
          <Button variant="outlined" onClick={() => router.push('/workflows')}>
            Open Flow Builder
          </Button>
        </Stack>
      </Stack>

      <CampaignBuilder
        onSubmit={async (input) => {
          const campaign = await createCampaign(input);
          router.push(`/campaigns/${campaign.id}`);
        }}
      />
    </Box>
  );
}

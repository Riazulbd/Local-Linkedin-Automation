'use client';

import Chip from '@mui/material/Chip';
import type { CampaignStatus } from '@/types';

const STATUS_COLOR: Record<CampaignStatus, 'default' | 'success' | 'warning' | 'info'> = {
  draft: 'default',
  active: 'success',
  paused: 'warning',
  completed: 'info',
  archived: 'default',
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return <Chip label={status} color={STATUS_COLOR[status]} size="small" />;
}

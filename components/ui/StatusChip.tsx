import Chip, { type ChipProps } from '@mui/material/Chip';

type Status =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'idle'
  | 'error'
  | 'active'
  | 'paused'
  | 'draft'
  | 'stopped'
  | 'archived'
  | 'opted_out'
  | 'unknown';

const statusConfig: Record<Status, ChipProps['color']> = {
  pending: 'default',
  running: 'info',
  completed: 'success',
  failed: 'error',
  skipped: 'warning',
  idle: 'default',
  error: 'error',
  active: 'success',
  paused: 'warning',
  draft: 'default',
  stopped: 'warning',
  archived: 'default',
  opted_out: 'warning',
  unknown: 'default',
};

export function StatusChip({
  status,
  ...props
}: { status: string } & Omit<ChipProps, 'color' | 'label'>) {
  const normalized = (status || 'unknown').toLowerCase() as Status;
  const color = statusConfig[normalized] ?? statusConfig.unknown;

  return <Chip label={normalized} color={color} size="small" {...props} />;
}

'use client';

import { DeleteOutlineRounded } from '@mui/icons-material';
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { CampaignStep, StepType } from '@/types';

const STEP_TYPES: StepType[] = [
  'visit_profile',
  'send_connection',
  'send_message',
  'follow_profile',
  'wait_days',
  'check_connection',
  'if_condition',
];

interface CampaignStepEditorProps {
  step: CampaignStep;
  onChange: (step: CampaignStep) => void;
  onDelete?: () => void;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function CampaignStepEditor({ step, onChange, onDelete }: CampaignStepEditorProps) {
  const stepType = step.step_type ?? step.type ?? 'visit_profile';
  const stepOrder = step.step_order ?? step.order ?? 0;
  const config = step.config ?? {};

  function patch(next: Partial<CampaignStep>) {
    const merged = {
      ...step,
      ...next,
    };

    const normalizedType = merged.step_type ?? merged.type ?? stepType;
    const normalizedOrder = merged.step_order ?? merged.order ?? stepOrder;

    onChange({
      ...merged,
      step_type: normalizedType,
      type: normalizedType,
      step_order: normalizedOrder,
      order: normalizedOrder,
      config: merged.config ?? {},
    });
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="subtitle2">Step {stepOrder + 1}</Typography>
        {onDelete && (
          <Button color="error" size="small" startIcon={<DeleteOutlineRounded />} onClick={onDelete}>
            Remove
          </Button>
        )}
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <FormControl size="small" fullWidth>
          <InputLabel>Type</InputLabel>
          <Select
            value={stepType}
            label="Type"
            onChange={(event) => {
              const value = event.target.value as StepType;
              patch({ step_type: value, type: value });
            }}
          >
            {STEP_TYPES.map((type) => (
              <MenuItem key={type} value={type}>
                {type}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          label="Label"
          size="small"
          value={step.label || ''}
          onChange={(event) => patch({ label: event.target.value })}
          placeholder="Optional label"
          fullWidth
        />
      </Stack>

      {stepType === 'send_connection' && (
        <TextField
          label="Connection note template"
          multiline
          rows={2}
          sx={{ mt: 2 }}
          value={readString(config.note ?? config.connectionNote)}
          onChange={(event) =>
            patch({
              config: {
                ...config,
                note: event.target.value,
                connectionNote: event.target.value,
              },
            })
          }
          fullWidth
        />
      )}

      {stepType === 'send_message' && (
        <TextField
          label="Message template"
          multiline
          rows={3}
          sx={{ mt: 2 }}
          value={readString(config.message ?? config.messageTemplate)}
          onChange={(event) =>
            patch({
              config: {
                ...config,
                message: event.target.value,
                messageTemplate: event.target.value,
              },
            })
          }
          fullWidth
        />
      )}

      {stepType === 'wait_days' && (
        <Box sx={{ mt: 2, width: 220 }}>
          <TextField
            label="Wait days"
            type="number"
            size="small"
            inputProps={{ min: 1 }}
            value={readNumber(config.days, 3)}
            onChange={(event) =>
              patch({
                config: {
                  ...config,
                  days: Math.max(1, Number(event.target.value) || 1),
                },
              })
            }
            fullWidth
          />
        </Box>
      )}
    </Paper>
  );
}

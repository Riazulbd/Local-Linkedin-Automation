'use client';

import { DeleteOutlineRounded } from '@mui/icons-material';
import type { Node } from 'reactflow';
import {
  Box,
  Button,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import type { NodeData } from '@/types';

type ConfigNodeData = NodeData & {
  status?: 'running' | 'success' | 'error' | 'skipped';
  highlighted?: boolean;
};

interface NodeConfigPanelProps {
  node: Node<ConfigNodeData> | null;
  onUpdate: (patch: Partial<NodeData>) => void;
  onDelete: () => void;
}

export function NodeConfigPanel({ node, onUpdate, onDelete }: NodeConfigPanelProps) {
  if (!node) {
    return (
      <Box sx={{ height: '100%', borderLeft: 1, borderColor: 'divider', p: 2.5 }}>
        <Typography variant="subtitle2">Node Config</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Select a node to edit action settings.
        </Typography>
      </Box>
    );
  }

  const data = node.data;

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', borderLeft: 1, borderColor: 'divider', p: 2.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle2">Node Config</Typography>
        <Button color="error" size="small" startIcon={<DeleteOutlineRounded />} onClick={onDelete}>
          Delete
        </Button>
      </Stack>

      <Stack spacing={2} sx={{ mt: 2 }}>
        <TextField
          label="Label"
          size="small"
          value={data.label ?? ''}
          onChange={(event) => onUpdate({ label: event.target.value })}
        />

        {node.type === 'visit_profile' && (
          <>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={Boolean(data.useCurrentLead)}
                  onChange={(event) => onUpdate({ useCurrentLead: event.target.checked })}
                />
              }
              label="Use current lead URL"
            />
            {!data.useCurrentLead && (
              <TextField
                label="Profile URL"
                size="small"
                value={data.url ?? ''}
                onChange={(event) => onUpdate({ url: event.target.value })}
                placeholder="https://www.linkedin.com/in/..."
              />
            )}
          </>
        )}

        {node.type === 'send_message' && (
          <TextField
            label="Message Template"
            value={data.messageTemplate ?? ''}
            onChange={(event) => onUpdate({ messageTemplate: event.target.value })}
            rows={8}
            multiline
          />
        )}

        {node.type === 'send_connection' && (
          <TextField
            label="Connection Note"
            value={data.connectionNote ?? ''}
            onChange={(event) => onUpdate({ connectionNote: event.target.value })}
            rows={5}
            multiline
          />
        )}

        {node.type === 'follow_profile' && (
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={data.fallbackToConnect !== false}
                onChange={(event) => onUpdate({ fallbackToConnect: event.target.checked })}
              />
            }
            label="Fallback to connect if follow unavailable"
          />
        )}

        {node.type === 'wait_delay' && (
          <>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={Boolean(data.useRandomRange)}
                  onChange={(event) => onUpdate({ useRandomRange: event.target.checked })}
                />
              }
              label="Use random range"
            />

            {data.useRandomRange ? (
              <Stack direction="row" spacing={1}>
                <TextField
                  label="Min Seconds"
                  size="small"
                  type="number"
                  value={String(data.minSeconds ?? 3)}
                  onChange={(event) => onUpdate({ minSeconds: Number(event.target.value) || 0 })}
                  fullWidth
                />
                <TextField
                  label="Max Seconds"
                  size="small"
                  type="number"
                  value={String(data.maxSeconds ?? 10)}
                  onChange={(event) => onUpdate({ maxSeconds: Number(event.target.value) || 0 })}
                  fullWidth
                />
              </Stack>
            ) : (
              <TextField
                label="Seconds"
                size="small"
                type="number"
                value={String(data.seconds ?? 5)}
                onChange={(event) => onUpdate({ seconds: Number(event.target.value) || 0 })}
              />
            )}
          </>
        )}

        {node.type === 'if_condition' && (
          <>
            <TextField
              label="Condition"
              size="small"
              value={data.condition ?? 'connection_status'}
              onChange={(event) => onUpdate({ condition: event.target.value })}
              placeholder="connection_status"
            />
            <TextField
              label="Condition Value"
              size="small"
              value={data.conditionValue ?? ''}
              onChange={(event) => onUpdate({ conditionValue: event.target.value })}
              placeholder="connected"
            />
          </>
        )}
      </Stack>
    </Box>
  );
}

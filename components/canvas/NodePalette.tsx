'use client';

import type { DragEvent, ElementType } from 'react';
import {
  AltRouteRounded,
  AutorenewRounded,
  LinkRounded,
  ManageSearchRounded,
  MessageRounded,
  PersonAddRounded,
  TimerRounded,
  VisibilityRounded,
} from '@mui/icons-material';
import { Box, Button, Stack, Typography } from '@mui/material';
import type { NodeType } from '@/types';

const NODE_OPTIONS: Array<{
  type: NodeType;
  label: string;
  icon: ElementType;
}> = [
  { type: 'visit_profile', label: 'Visit Profile', icon: VisibilityRounded },
  { type: 'send_message', label: 'Send Message', icon: MessageRounded },
  { type: 'follow_profile', label: 'Follow Profile', icon: PersonAddRounded },
  { type: 'send_connection', label: 'Send Connection', icon: LinkRounded },
  { type: 'wait_delay', label: 'Wait Delay', icon: TimerRounded },
  { type: 'check_connection', label: 'Check Connection', icon: ManageSearchRounded },
  { type: 'if_condition', label: 'If Condition', icon: AltRouteRounded },
  { type: 'loop_leads', label: 'Loop Leads', icon: AutorenewRounded },
];

export function NodePalette() {
  const onDragStart = (event: DragEvent<HTMLButtonElement>, nodeType: NodeType) => {
    event.dataTransfer.setData('application/x-node-type', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', borderRight: 1, borderColor: 'divider', p: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 2 }}>
        Node Palette
      </Typography>
      <Stack spacing={1}>
        {NODE_OPTIONS.map((node) => {
          const Icon = node.icon;
          return (
            <Button
              key={node.type}
              type="button"
              draggable
              onDragStart={(event) => onDragStart(event, node.type)}
              variant="outlined"
              color="inherit"
              startIcon={<Icon fontSize="small" />}
              sx={{
                justifyContent: 'flex-start',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                color: 'text.primary',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'action.hover',
                },
              }}
            >
              {node.label}
            </Button>
          );
        })}
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
        Drag nodes into canvas and connect outputs to inputs.
      </Typography>
    </Box>
  );
}

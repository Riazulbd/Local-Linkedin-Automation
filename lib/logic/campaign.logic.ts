import type { CampaignStep, CampaignStepType } from '@/types';

const DEFAULT_SEQUENCE: CampaignStep[] = [
  {
    id: 'step_visit',
    type: 'visit_profile',
    order: 0,
    label: 'Visit profile',
    config: { dwellSeconds: { min: 8, max: 18 } },
  },
  {
    id: 'step_connect',
    type: 'send_connection',
    order: 1,
    label: 'Send connection',
    config: { connectionNote: '' },
  },
  {
    id: 'step_wait',
    type: 'wait_days',
    order: 2,
    label: 'Wait',
    config: { days: 2 },
  },
  {
    id: 'step_message',
    type: 'send_message',
    order: 3,
    label: 'Send message',
    config: { messageTemplate: '' },
  },
];

export function buildDefaultCampaignSequence(): CampaignStep[] {
  return DEFAULT_SEQUENCE.map((step) => ({
    ...step,
    config: { ...step.config },
  }));
}

export function normalizeCampaignSequence(rawSequence: unknown): CampaignStep[] {
  if (!Array.isArray(rawSequence)) return buildDefaultCampaignSequence();

  return rawSequence
    .map((entry, index) => {
      const row = (entry ?? {}) as Record<string, unknown>;
      return {
        id: String(row.id || `step_${index + 1}`),
        type: String(row.type || 'visit_profile') as CampaignStepType,
        order: Number(row.order ?? index),
        config: ((row.config as Record<string, unknown>) ?? {}) as CampaignStep['config'],
        label: row.label == null ? undefined : String(row.label),
      } satisfies CampaignStep;
    })
    .sort((a, b) => a.order - b.order);
}

export function validateCampaignSequence(sequence: CampaignStep[]) {
  if (!Array.isArray(sequence) || sequence.length === 0) {
    return { valid: false, reason: 'Campaign sequence is empty' };
  }

  for (const [index, step] of sequence.entries()) {
    if (!step.type) {
      return { valid: false, reason: `Step ${index + 1} missing type` };
    }
    if (step.type === 'send_message' && !String(step.config.messageTemplate || '').trim()) {
      return { valid: false, reason: `Step ${index + 1} requires messageTemplate` };
    }
  }

  return { valid: true as const };
}

export function summarizeCampaignSequence(sequence: CampaignStep[]) {
  return sequence.map((step) => ({
    id: step.id,
    type: step.type,
    label: step.label || step.type.replace(/_/g, ' '),
    order: step.order,
  }));
}

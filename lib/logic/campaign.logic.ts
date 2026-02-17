import type { CampaignStep, StepType } from '@/types';

const VALID_STEP_TYPES: StepType[] = [
  'visit_profile',
  'send_connection',
  'send_message',
  'follow_profile',
  'wait_days',
  'check_connection',
  'if_condition',
];

const DEFAULT_STEPS: CampaignStep[] = [
  {
    id: 'step_visit',
    step_order: 0,
    step_type: 'visit_profile',
    type: 'visit_profile',
    order: 0,
    label: 'Visit profile',
    config: {},
  },
  {
    id: 'step_connect',
    step_order: 1,
    step_type: 'send_connection',
    type: 'send_connection',
    order: 1,
    label: 'Connect',
    config: { note: '' },
  },
  {
    id: 'step_wait',
    step_order: 2,
    step_type: 'wait_days',
    type: 'wait_days',
    order: 2,
    label: 'Wait 3 days',
    config: { days: 3, minHours: 68, maxHours: 76 },
  },
  {
    id: 'step_message',
    step_order: 3,
    step_type: 'send_message',
    type: 'send_message',
    order: 3,
    label: 'Message',
    config: { message: '' },
  },
];

function isStepType(value: string): value is StepType {
  return VALID_STEP_TYPES.includes(value as StepType);
}

function asStepType(value: unknown): StepType {
  const normalized = String(value || '').trim();
  if (isStepType(normalized)) {
    return normalized;
  }
  return 'visit_profile';
}

function asConfig(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function buildDefaultCampaignSequence(): CampaignStep[] {
  return DEFAULT_STEPS.map((step) => ({
    ...step,
    config: { ...step.config },
  }));
}

export function normalizeCampaignSequence(rawSteps: unknown): CampaignStep[] {
  if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
    return buildDefaultCampaignSequence();
  }

  const mapped = rawSteps
    .map((entry, index) => {
      const row = (entry ?? {}) as Record<string, unknown>;
      const step_type = asStepType(row.step_type ?? row.type);
      const step_order = Number(
        row.step_order ??
          row.order ??
          index
      );

      const id = String(row.id || `step_${index + 1}`);
      const config = asConfig(row.config);
      const label = row.label == null ? undefined : String(row.label);

      return {
        id,
        step_type,
        step_order: Number.isFinite(step_order) ? step_order : index,
        type: step_type,
        order: Number.isFinite(step_order) ? step_order : index,
        label,
        config,
      } satisfies CampaignStep;
    })
    .sort((a, b) => a.step_order - b.step_order)
    .map((step, index) => ({
      ...step,
      step_order: index,
      order: index,
    }));

  return mapped.length ? mapped : buildDefaultCampaignSequence();
}

export function validateCampaignSequence(steps: CampaignStep[]) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return { valid: false, reason: 'Campaign steps are empty' };
  }

  for (const [index, step] of steps.entries()) {
    if (!isStepType(step.step_type)) {
      return { valid: false, reason: `Step ${index + 1} has invalid type` };
    }

    if (step.step_type === 'send_message') {
      const rawMessage = String(step.config.message ?? step.config.messageTemplate ?? '').trim();
      if (!rawMessage) {
        return { valid: false, reason: `Step ${index + 1} requires a message template` };
      }
    }

    if (step.step_type === 'wait_days') {
      const days = Number(step.config.days ?? 0);
      if (!Number.isFinite(days) || days <= 0) {
        return { valid: false, reason: `Step ${index + 1} wait_days requires days > 0` };
      }
    }
  }

  return { valid: true as const };
}

export function summarizeCampaignSequence(steps: CampaignStep[]) {
  return steps.map((step) => ({
    id: step.id,
    type: step.step_type,
    label: step.label || step.step_type.replace(/_/g, ' '),
    order: step.step_order,
  }));
}

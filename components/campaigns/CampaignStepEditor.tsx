'use client';

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
    <div className="rounded-lg border border-slate-200 bg-slate-100 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-700">Step {stepOrder + 1}</span>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="text-[11px] text-rose-300 hover:text-rose-200"
          >
            Remove
          </button>
        )}
      </div>

      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <label className="text-xs text-slate-600">
          Type
          <select
            value={stepType}
            onChange={(event) => {
              const value = event.target.value as StepType;
              patch({ step_type: value, type: value });
            }}
            className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-900"
          >
            {STEP_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-slate-600">
          Label
          <input
            value={step.label || ''}
            onChange={(event) => patch({ label: event.target.value })}
            placeholder="Optional label"
            className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-900 placeholder:text-slate-400"
          />
        </label>
      </div>

      {stepType === 'send_connection' && (
        <label className="mt-2 block text-xs text-slate-600">
          Connection note template
          <textarea
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
            rows={2}
            className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-900 placeholder:text-slate-400"
          />
        </label>
      )}

      {stepType === 'send_message' && (
        <label className="mt-2 block text-xs text-slate-600">
          Message template
          <textarea
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
            rows={3}
            className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-900 placeholder:text-slate-400"
          />
        </label>
      )}

      {stepType === 'wait_days' && (
        <label className="mt-2 block text-xs text-slate-600">
          Wait days
          <input
            type="number"
            min={1}
            value={readNumber(config.days, 3)}
            onChange={(event) =>
              patch({
                config: {
                  ...config,
                  days: Math.max(1, Number(event.target.value) || 1),
                },
              })
            }
            className="mt-1 w-28 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-900"
          />
        </label>
      )}
    </div>
  );
}

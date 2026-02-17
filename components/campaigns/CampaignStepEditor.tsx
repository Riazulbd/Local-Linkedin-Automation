'use client';

import type { CampaignStep, CampaignStepType } from '@/types';

const STEP_TYPES: CampaignStepType[] = [
  'visit_profile',
  'send_connection',
  'send_message',
  'follow_profile',
  'wait_days',
  'check_connected',
  'withdraw_connection',
];

interface CampaignStepEditorProps {
  step: CampaignStep;
  onChange: (step: CampaignStep) => void;
  onDelete?: () => void;
}

export function CampaignStepEditor({ step, onChange, onDelete }: CampaignStepEditorProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-white/80">Step {step.order + 1}</span>
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
        <label className="text-xs text-white/70">
          Type
          <select
            value={step.type}
            onChange={(event) =>
              onChange({
                ...step,
                type: event.target.value as CampaignStepType,
              })
            }
            className="mt-1 w-full rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-white"
          >
            {STEP_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-white/70">
          Label
          <input
            value={step.label || ''}
            onChange={(event) => onChange({ ...step, label: event.target.value })}
            placeholder="Optional label"
            className="mt-1 w-full rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-white placeholder:text-white/30"
          />
        </label>
      </div>

      {step.type === 'send_connection' && (
        <label className="mt-2 block text-xs text-white/70">
          Connection note template
          <textarea
            value={step.config.connectionNote || ''}
            onChange={(event) =>
              onChange({
                ...step,
                config: { ...step.config, connectionNote: event.target.value },
              })
            }
            rows={2}
            className="mt-1 w-full rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-white placeholder:text-white/30"
          />
        </label>
      )}

      {step.type === 'send_message' && (
        <label className="mt-2 block text-xs text-white/70">
          Message template
          <textarea
            value={step.config.messageTemplate || ''}
            onChange={(event) =>
              onChange({
                ...step,
                config: { ...step.config, messageTemplate: event.target.value },
              })
            }
            rows={3}
            className="mt-1 w-full rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-white placeholder:text-white/30"
          />
        </label>
      )}

      {step.type === 'wait_days' && (
        <label className="mt-2 block text-xs text-white/70">
          Wait days
          <input
            type="number"
            min={1}
            value={step.config.days ?? 1}
            onChange={(event) =>
              onChange({
                ...step,
                config: { ...step.config, days: Number(event.target.value) || 1 },
              })
            }
            className="mt-1 w-28 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-white"
          />
        </label>
      )}
    </div>
  );
}

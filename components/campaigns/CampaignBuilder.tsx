'use client';

import { useMemo, useState } from 'react';
import type { CampaignStep, CreateCampaignInput } from '@/types';
import { buildDefaultCampaignSequence } from '@/lib/logic/campaign.logic';
import { CampaignStepEditor } from './CampaignStepEditor';

interface CampaignBuilderProps {
  onSubmit: (input: CreateCampaignInput) => Promise<void>;
  initialName?: string;
}

export function CampaignBuilder({ onSubmit, initialName = '' }: CampaignBuilderProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState('');
  const [dailyNewLeads, setDailyNewLeads] = useState(20);
  const [profileIdsRaw, setProfileIdsRaw] = useState('');
  const [folderIdsRaw, setFolderIdsRaw] = useState('');
  const [steps, setSteps] = useState<CampaignStep[]>(() => buildDefaultCampaignSequence());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profileIds = useMemo(
    () => profileIdsRaw.split(',').map((s) => s.trim()).filter(Boolean),
    [profileIdsRaw]
  );
  const folderIds = useMemo(
    () => folderIdsRaw.split(',').map((s) => s.trim()).filter(Boolean),
    [folderIdsRaw]
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Campaign name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        sequence: steps,
        daily_new_leads: dailyNewLeads,
        profile_ids: profileIds,
        folder_ids: folderIds,
      });
      setName('');
      setDescription('');
      setDailyNewLeads(20);
      setProfileIdsRaw('');
      setFolderIdsRaw('');
      setSteps(buildDefaultCampaignSequence());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create campaign');
    } finally {
      setIsSubmitting(false);
    }
  }

  function addStep() {
    setSteps((prev) => [
      ...prev,
      {
        id: `step_${Date.now()}`,
        type: 'visit_profile',
        order: prev.length,
        config: {},
      },
    ]);
  }

  function updateStep(index: number, updated: CampaignStep) {
    setSteps((prev) => prev.map((step, idx) => (idx === index ? { ...updated, order: idx } : step)));
  }

  function deleteStep(index: number) {
    setSteps((prev) =>
      prev.filter((_, idx) => idx !== index).map((step, idx) => ({ ...step, order: idx }))
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-900">Create Campaign</h3>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="text-xs text-slate-600">
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-900"
          />
        </label>
        <label className="text-xs text-slate-600">
          Daily new leads
          <input
            type="number"
            min={1}
            max={500}
            value={dailyNewLeads}
            onChange={(event) => setDailyNewLeads(Number(event.target.value) || 20)}
            className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-900"
          />
        </label>
      </div>

      <label className="mt-3 block text-xs text-slate-600">
        Description
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-900"
        />
      </label>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="text-xs text-slate-600">
          Profile IDs (comma-separated)
          <input
            value={profileIdsRaw}
            onChange={(event) => setProfileIdsRaw(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-900"
          />
        </label>
        <label className="text-xs text-slate-600">
          Folder IDs (comma-separated)
          <input
            value={folderIdsRaw}
            onChange={(event) => setFolderIdsRaw(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-900"
          />
        </label>
      </div>

      <div className="mt-4 space-y-2">
        {steps.map((step, index) => (
          <CampaignStepEditor
            key={step.id}
            step={step}
            onChange={(updated) => updateStep(index, updated)}
            onDelete={steps.length > 1 ? () => deleteStep(index) : undefined}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={addStep}
          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100"
        >
          Add Step
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md border border-cyan-400/40 px-2.5 py-1 text-xs text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-60"
        >
          {isSubmitting ? 'Creating...' : 'Create Campaign'}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </form>
  );
}

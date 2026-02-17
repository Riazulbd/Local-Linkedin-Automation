'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CampaignStepEditor } from '@/components/campaigns/CampaignStepEditor';
import { CampaignStatusBadge } from '@/components/campaigns/CampaignStatusBadge';
import { useCampaignContext } from '@/lib/context/CampaignContext';
import type { CampaignStep, LeadFolder, LinkedInProfile } from '@/types';

function normalizeStep(step: CampaignStep, index: number): CampaignStep {
  const type = step.step_type ?? step.type ?? 'visit_profile';
  return {
    ...step,
    step_type: type,
    type,
    step_order: index,
    order: index,
    config: step.config ?? {},
  };
}

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const campaignId = String(params?.id || '');

  const {
    campaigns,
    steps,
    selectCampaign,
    setSteps,
    updateStep,
    addStep,
    removeStep,
    refreshCampaigns,
    updateCampaign,
    startCampaign,
    stopCampaign,
  } = useCampaignContext();

  const campaign = campaigns.find((entry) => entry.id === campaignId) ?? null;

  const [profiles, setProfiles] = useState<LinkedInProfile[]>([]);
  const [folders, setFolders] = useState<LeadFolder[]>([]);
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [dailyNewLeads, setDailyNewLeads] = useState(10);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    refreshCampaigns().catch(() => undefined);
  }, [refreshCampaigns]);

  useEffect(() => {
    if (!campaignId) return;
    selectCampaign(campaignId);
  }, [campaignId, selectCampaign]);

  useEffect(() => {
    if (!campaign) return;

    const campaignSteps = campaign.steps ?? campaign.sequence ?? [];
    setSteps(campaignSteps.map((step, index) => normalizeStep(step, index)));
    setSelectedProfileIds(campaign.profiles ?? campaign.profile_ids ?? []);
    setSelectedFolderId(campaign.folder_id || '');
    setDailyNewLeads(campaign.daily_new_leads || 10);
  }, [campaign, setSteps]);

  useEffect(() => {
    let mounted = true;
    async function loadOptions() {
      try {
        const [profileRes, folderRes] = await Promise.all([
          fetch('/api/profiles', { cache: 'no-store' }),
          fetch('/api/lead-folders', { cache: 'no-store' }),
        ]);

        const profilePayload = await profileRes.json().catch(() => ({}));
        const folderPayload = await folderRes.json().catch(() => ({}));

        if (!profileRes.ok) throw new Error(profilePayload.error || 'Failed to load profiles');
        if (!folderRes.ok) throw new Error(folderPayload.error || 'Failed to load folders');

        if (!mounted) return;
        setProfiles(profilePayload.profiles ?? []);
        setFolders(folderPayload.folders ?? []);
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load campaign options');
      }
    }

    loadOptions().catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  const orderedSteps = useMemo(
    () => steps.map((step, index) => normalizeStep(step, index)),
    [steps]
  );

  function toggleProfile(profileId: string) {
    setSelectedProfileIds((prev) =>
      prev.includes(profileId)
        ? prev.filter((id) => id !== profileId)
        : [...prev, profileId]
    );
  }

  function moveStep(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= orderedSteps.length) return;
    const next = [...orderedSteps];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setSteps(next.map((step, index) => normalizeStep(step, index)));
  }

  async function saveCampaign() {
    if (!campaign) return;

    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateCampaign(campaign.id, {
        steps: orderedSteps,
        sequence: orderedSteps,
        profile_ids: selectedProfileIds,
        profiles: selectedProfileIds,
        folder_id: selectedFolderId || null,
        daily_new_leads: dailyNewLeads,
      });
      await refreshCampaigns();
      setMessage('Campaign updated');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save campaign');
    } finally {
      setIsSaving(false);
    }
  }

  if (!campaign) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <p className="text-sm text-slate-500">Campaign not found or still loading.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href="/campaigns" className="text-xs text-slate-500 hover:text-slate-700">
            Back to campaigns
          </Link>
          <h1 className="text-xl font-semibold text-slate-900">{campaign.name}</h1>
          <p className="text-sm text-slate-500">{campaign.description || 'No description'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CampaignStatusBadge status={campaign.status} />
          <button
            type="button"
            onClick={() => startCampaign(campaign.id).catch(() => undefined)}
            className="rounded-md border border-emerald-500/40 px-2.5 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20"
          >
            Activate
          </button>
          <button
            type="button"
            onClick={() => stopCampaign(campaign.id).catch(() => undefined)}
            className="rounded-md border border-amber-500/40 px-2.5 py-1 text-xs text-amber-200 hover:bg-amber-500/20"
          >
            Pause
          </button>
          <button
            type="button"
            onClick={() => updateCampaign(campaign.id, { status: 'archived' }).catch(() => undefined)}
            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
          >
            Archive
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}
      {message && <p className="text-sm text-emerald-300">{message}</p>}

      <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Step Builder</h2>
          <button
            type="button"
            onClick={() => addStep('visit_profile')}
            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
          >
            Add Step
          </button>
        </div>

        <div className="space-y-2">
          {orderedSteps.map((step, index) => (
            <div key={step.id} className="space-y-1">
              <CampaignStepEditor
                step={step}
                onChange={(updated) => updateStep(index, updated)}
                onDelete={orderedSteps.length > 1 ? () => removeStep(index) : undefined}
              />
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => moveStep(index, index - 1)}
                  className="rounded border border-slate-300 px-2 py-0.5 text-[10px] text-slate-600 hover:bg-slate-100"
                >
                  Move Up
                </button>
                <button
                  type="button"
                  onClick={() => moveStep(index, index + 1)}
                  className="rounded border border-slate-300 px-2 py-0.5 text-[10px] text-slate-600 hover:bg-slate-100"
                >
                  Move Down
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Attached Profiles</h2>
          <div className="mt-2 max-h-64 space-y-1 overflow-auto">
            {profiles.map((profile) => (
              <label key={profile.id} className="flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={selectedProfileIds.includes(profile.id)}
                  onChange={() => toggleProfile(profile.id)}
                />
                <span className="truncate">{profile.name}</span>
              </label>
            ))}
            {!profiles.length && (
              <p className="text-xs text-slate-500">No profiles found.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Execution Settings</h2>

          <label className="block text-xs text-slate-600">
            Lead Folder
            <select
              value={selectedFolderId}
              onChange={(event) => setSelectedFolderId(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-900"
            >
              <option value="">None</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-slate-600">
            Daily New Leads: <span className="font-semibold">{dailyNewLeads}</span>
            <input
              type="range"
              min={1}
              max={100}
              value={dailyNewLeads}
              onChange={(event) => setDailyNewLeads(Number(event.target.value))}
              className="mt-2 w-full"
            />
          </label>

          <button
            type="button"
            onClick={() => saveCampaign().catch(() => undefined)}
            disabled={isSaving}
            className="rounded-md border border-cyan-400/40 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-60"
          >
            {isSaving ? 'Saving...' : 'Save Campaign'}
          </button>
        </div>
      </section>
    </main>
  );
}

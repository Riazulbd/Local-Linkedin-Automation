'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import { normalizeCampaignSequence } from '@/lib/logic/campaign.logic';
import type { Campaign, CampaignStatus, CampaignStep, CreateCampaignInput } from '@/types';

interface CampaignContextValue {
  campaigns: Campaign[];
  selectedCampaignId: string | null;
  selectedCampaign: Campaign | null;
  steps: CampaignStep[];
  isLoading: boolean;
  error: string | null;
  refreshCampaigns: () => Promise<void>;
  selectCampaign: (campaignId: string | null) => void;
  setSteps: (steps: CampaignStep[]) => void;
  updateStep: (stepOrder: number, patch: Partial<CampaignStep>) => void;
  addStep: (stepType?: CampaignStep['step_type']) => void;
  removeStep: (stepOrder: number) => void;
  createCampaign: (input: CreateCampaignInput) => Promise<Campaign>;
  updateCampaign: (campaignId: string, patch: Partial<Campaign>) => Promise<Campaign>;
  deleteCampaign: (campaignId: string) => Promise<void>;
  setStatus: (campaignId: string, status: CampaignStatus) => Promise<void>;
  startCampaign: (campaignId: string) => Promise<void>;
  stopCampaign: (campaignId: string) => Promise<void>;
}

const CampaignContext = createContext<CampaignContextValue | null>(null);

function normalizeStepsForContext(steps: CampaignStep[]): CampaignStep[] {
  return normalizeCampaignSequence(steps).map((step, index) => ({
    ...step,
    step_order: index,
    order: index,
    type: step.step_type,
  }));
}

export function CampaignProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [steps, setStepsState] = useState<CampaignStep[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshCampaigns = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/campaigns', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to load campaigns');

      const rows = (payload.campaigns ?? []) as Campaign[];
      setCampaigns(rows);
      setSelectedCampaignId((current) => {
        if (current && rows.some((campaign) => campaign.id === current)) {
          return current;
        }
        return rows[0]?.id ?? null;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load campaigns');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCampaigns().catch(() => undefined);
  }, [refreshCampaigns]);

  useEffect(() => {
    const selected = campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null;
    const campaignSteps = selected?.steps ?? selected?.sequence ?? [];
    setStepsState(normalizeStepsForContext(campaignSteps));
  }, [campaigns, selectedCampaignId]);

  useEffect(() => {
    const channel = supabase
      .channel('campaigns-realtime-context')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaigns' },
        () => {
          refreshCampaigns().catch(() => undefined);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(() => undefined);
    };
  }, [refreshCampaigns, supabase]);

  const createCampaignAction = useCallback(async (input: CreateCampaignInput) => {
    const response = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Failed to create campaign');

    const created = payload.campaign as Campaign;
    setCampaigns((prev) => [created, ...prev]);
    setSelectedCampaignId(created.id);
    return created;
  }, []);

  const updateCampaignAction = useCallback(async (campaignId: string, patch: Partial<Campaign>) => {
    const response = await fetch(`/api/campaigns/${campaignId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Failed to update campaign');

    const updated = payload.campaign as Campaign;
    if (updated) {
      setCampaigns((prev) => prev.map((campaign) => (campaign.id === campaignId ? updated : campaign)));
      if (campaignId === selectedCampaignId) {
        const updatedSteps = updated.steps ?? updated.sequence ?? [];
        setStepsState(normalizeStepsForContext(updatedSteps));
      }
    }
    return updated;
  }, [selectedCampaignId]);

  const deleteCampaignAction = useCallback(async (campaignId: string) => {
    const response = await fetch(`/api/campaigns/${campaignId}`, { method: 'DELETE' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Failed to delete campaign');

    setCampaigns((prev) => prev.filter((campaign) => campaign.id !== campaignId));
    setSelectedCampaignId((current) => (current === campaignId ? null : current));
  }, []);

  const setStatus = useCallback(
    async (campaignId: string, status: CampaignStatus) => {
      await updateCampaignAction(campaignId, { status });
    },
    [updateCampaignAction]
  );

  const startCampaign = useCallback(async (campaignId: string) => {
    const response = await fetch(`/api/campaigns/${campaignId}/start`, { method: 'POST' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Failed to start campaign');
    await refreshCampaigns();
  }, [refreshCampaigns]);

  const stopCampaign = useCallback(async (campaignId: string) => {
    const response = await fetch(`/api/campaigns/${campaignId}/stop`, { method: 'POST' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Failed to stop campaign');
    await refreshCampaigns();
  }, [refreshCampaigns]);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId]
  );

  const setSteps = useCallback((nextSteps: CampaignStep[]) => {
    setStepsState(normalizeStepsForContext(nextSteps));
  }, []);

  const updateStep = useCallback((stepOrder: number, patch: Partial<CampaignStep>) => {
    setStepsState((prev) =>
      prev.map((step, index) => {
        if (index !== stepOrder) return step;
        const merged = {
          ...step,
          ...patch,
        };
        const stepType = merged.step_type ?? merged.type ?? step.step_type;
        return {
          ...merged,
          step_type: stepType,
          type: stepType,
          step_order: index,
          order: index,
          config: merged.config ?? {},
        };
      })
    );
  }, []);

  const addStep = useCallback((stepType: CampaignStep['step_type'] = 'visit_profile') => {
    setStepsState((prev) => [
      ...prev,
      {
        id: `step_${Date.now()}`,
        step_type: stepType,
        type: stepType,
        step_order: prev.length,
        order: prev.length,
        config: {},
      },
    ]);
  }, []);

  const removeStep = useCallback((stepOrder: number) => {
    setStepsState((prev) =>
      prev
        .filter((_, index) => index !== stepOrder)
        .map((step, index) => ({
          ...step,
          step_order: index,
          order: index,
        }))
    );
  }, []);

  const value = useMemo<CampaignContextValue>(
    () => ({
      campaigns,
      selectedCampaignId,
      selectedCampaign,
      steps,
      isLoading,
      error,
      refreshCampaigns,
      selectCampaign: setSelectedCampaignId,
      setSteps,
      updateStep,
      addStep,
      removeStep,
      createCampaign: createCampaignAction,
      updateCampaign: updateCampaignAction,
      deleteCampaign: deleteCampaignAction,
      setStatus,
      startCampaign,
      stopCampaign,
    }),
    [
      campaigns,
      selectedCampaignId,
      selectedCampaign,
      steps,
      isLoading,
      error,
      refreshCampaigns,
      setSteps,
      updateStep,
      addStep,
      removeStep,
      createCampaignAction,
      updateCampaignAction,
      deleteCampaignAction,
      setStatus,
      startCampaign,
      stopCampaign,
    ]
  );

  return <CampaignContext.Provider value={value}>{children}</CampaignContext.Provider>;
}

export function useCampaignContext() {
  const ctx = useContext(CampaignContext);
  if (!ctx) {
    throw new Error('useCampaignContext must be used within CampaignProvider');
  }
  return ctx;
}

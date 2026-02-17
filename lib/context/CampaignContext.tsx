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
import type { Campaign, CampaignStatus, CreateCampaignInput } from '@/types';

interface CampaignContextValue {
  campaigns: Campaign[];
  selectedCampaignId: string | null;
  selectedCampaign: Campaign | null;
  isLoading: boolean;
  error: string | null;
  refreshCampaigns: () => Promise<void>;
  selectCampaign: (campaignId: string | null) => void;
  createCampaign: (input: CreateCampaignInput) => Promise<Campaign>;
  updateCampaign: (campaignId: string, patch: Partial<Campaign>) => Promise<Campaign>;
  deleteCampaign: (campaignId: string) => Promise<void>;
  setStatus: (campaignId: string, status: CampaignStatus) => Promise<void>;
  startCampaign: (campaignId: string) => Promise<void>;
  stopCampaign: (campaignId: string) => Promise<void>;
}

const CampaignContext = createContext<CampaignContextValue | null>(null);

export function CampaignProvider({ children }: { children: ReactNode }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshCampaigns = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/campaigns', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Failed to load campaigns');
      setCampaigns(payload.campaigns ?? []);
      setSelectedCampaignId((current) => current ?? payload.campaigns?.[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCampaigns().catch(() => undefined);
  }, [refreshCampaigns]);

  const createCampaignAction = useCallback(async (input: CreateCampaignInput) => {
    const response = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const payload = await response.json();
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
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Failed to update campaign');

    const updated = payload.campaign as Campaign;
    setCampaigns((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    return updated;
  }, []);

  const deleteCampaignAction = useCallback(async (campaignId: string) => {
    const response = await fetch(`/api/campaigns/${campaignId}`, { method: 'DELETE' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Failed to delete campaign');

    setCampaigns((prev) => prev.filter((row) => row.id !== campaignId));
    setSelectedCampaignId((current) => (current === campaignId ? null : current));
  }, []);

  const setStatus = useCallback(async (campaignId: string, status: CampaignStatus) => {
    await updateCampaignAction(campaignId, { status });
  }, [updateCampaignAction]);

  const startCampaign = useCallback(async (campaignId: string) => {
    const response = await fetch(`/api/campaigns/${campaignId}/start`, { method: 'POST' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Failed to start campaign');
    await refreshCampaigns();
  }, [refreshCampaigns]);

  const stopCampaign = useCallback(async (campaignId: string) => {
    const response = await fetch(`/api/campaigns/${campaignId}/stop`, { method: 'POST' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Failed to stop campaign');
    await refreshCampaigns();
  }, [refreshCampaigns]);

  const selectedCampaign = useMemo(
    () => campaigns.find((row) => row.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId]
  );

  const value = useMemo<CampaignContextValue>(
    () => ({
      campaigns,
      selectedCampaignId,
      selectedCampaign,
      isLoading,
      error,
      refreshCampaigns,
      selectCampaign: setSelectedCampaignId,
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
      isLoading,
      error,
      refreshCampaigns,
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
  if (!ctx) throw new Error('useCampaignContext must be used within CampaignProvider');
  return ctx;
}

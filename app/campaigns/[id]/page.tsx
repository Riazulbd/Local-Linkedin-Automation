'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { CampaignLeadProgress } from '@/types';
import { CampaignRunPanel } from '@/components/campaigns/CampaignRunPanel';
import { CampaignStatusBadge } from '@/components/campaigns/CampaignStatusBadge';
import { useCampaignContext } from '@/lib/context/CampaignContext';

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const campaignId = String(params?.id || '');

  const { campaigns, startCampaign, stopCampaign, refreshCampaigns } = useCampaignContext();
  const campaign = campaigns.find((row) => row.id === campaignId) ?? null;

  const [progress, setProgress] = useState<CampaignLeadProgress[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refreshCampaigns().catch(() => undefined);
  }, [refreshCampaigns]);

  useEffect(() => {
    if (!campaignId) return;
    let mounted = true;

    async function loadProgress() {
      try {
        const response = await fetch(`/api/campaigns/${campaignId}`, { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Failed to load campaign');
        if (!mounted) return;
        setProgress((payload.progress ?? []) as CampaignLeadProgress[]);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load campaign progress');
      }
    }

    loadProgress().catch(() => undefined);
    const interval = window.setInterval(() => {
      loadProgress().catch(() => undefined);
    }, 15000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [campaignId]);

  if (!campaign) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <p className="text-sm text-white/60">Campaign not found or still loading.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-white">{campaign.name}</h1>
          <p className="text-sm text-white/60">{campaign.description || 'No description'}</p>
        </div>
        <div className="flex items-center gap-2">
          <CampaignStatusBadge status={campaign.status} />
          <button
            type="button"
            onClick={() => startCampaign(campaign.id).catch(() => undefined)}
            className="rounded-md border border-emerald-500/40 px-2.5 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20"
          >
            Start
          </button>
          <button
            type="button"
            onClick={() => stopCampaign(campaign.id).catch(() => undefined)}
            className="rounded-md border border-amber-500/40 px-2.5 py-1 text-xs text-amber-200 hover:bg-amber-500/20"
          >
            Pause
          </button>
          <Link
            href={`/campaigns/${campaign.id}/analytics`}
            className="rounded-md border border-white/20 px-2.5 py-1 text-xs text-white/80 hover:bg-white/10"
          >
            Analytics
          </Link>
        </div>
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}
      <CampaignRunPanel progress={progress} />
    </main>
  );
}

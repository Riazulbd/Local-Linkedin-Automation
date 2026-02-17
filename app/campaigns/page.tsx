'use client';

import Link from 'next/link';
import { CampaignList } from '@/components/campaigns/CampaignList';
import { useCampaignContext } from '@/lib/context/CampaignContext';

export default function CampaignsPage() {
  const {
    campaigns,
    selectedCampaignId,
    isLoading,
    error,
    selectCampaign,
    startCampaign,
    stopCampaign,
    deleteCampaign,
  } = useCampaignContext();

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-white">Campaigns</h1>
          <p className="text-sm text-white/60">Manage multi-step outreach sequences.</p>
        </div>
        <Link
          href="/campaigns/new"
          className="rounded-md border border-cyan-400/40 px-3 py-1.5 text-sm text-cyan-200 hover:bg-cyan-500/20"
        >
          New Campaign
        </Link>
      </div>

      {isLoading && <p className="text-sm text-white/60">Loading campaigns...</p>}
      {error && <p className="text-sm text-rose-300">{error}</p>}

      <CampaignList
        campaigns={campaigns}
        selectedCampaignId={selectedCampaignId}
        onSelect={selectCampaign}
        onStart={(id) => startCampaign(id).catch(() => undefined)}
        onStop={(id) => stopCampaign(id).catch(() => undefined)}
        onDelete={(id) => deleteCampaign(id).catch(() => undefined)}
      />
    </main>
  );
}

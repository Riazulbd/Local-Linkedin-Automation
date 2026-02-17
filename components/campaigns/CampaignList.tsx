'use client';

import type { Campaign } from '@/types';
import { CampaignCard } from './CampaignCard';

interface CampaignListProps {
  campaigns: Campaign[];
  selectedCampaignId?: string | null;
  onSelect?: (campaignId: string) => void;
  onStart?: (campaignId: string) => void;
  onStop?: (campaignId: string) => void;
  onDelete?: (campaignId: string) => void;
}

export function CampaignList({
  campaigns,
  selectedCampaignId = null,
  onSelect,
  onStart,
  onStop,
  onDelete,
}: CampaignListProps) {
  if (!campaigns.length) {
    return (
      <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-6 text-sm text-white/60">
        No campaigns yet. Create your first campaign to begin.
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {campaigns.map((campaign) => (
        <CampaignCard
          key={campaign.id}
          campaign={campaign}
          selected={selectedCampaignId === campaign.id}
          onSelect={onSelect}
          onStart={onStart}
          onStop={onStop}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

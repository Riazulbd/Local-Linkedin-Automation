'use client';

import { useRouter } from 'next/navigation';
import { CampaignBuilder } from '@/components/campaigns/CampaignBuilder';
import { useCampaignContext } from '@/lib/context/CampaignContext';

export default function NewCampaignPage() {
  const router = useRouter();
  const { createCampaign } = useCampaignContext();

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Create Campaign</h1>
        <p className="text-sm text-slate-500">Define sequence steps, folders, and profile mappings.</p>
      </div>

      <CampaignBuilder
        onSubmit={async (input) => {
          const campaign = await createCampaign(input);
          router.push(`/campaigns/${campaign.id}`);
        }}
      />
    </main>
  );
}

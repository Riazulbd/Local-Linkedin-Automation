'use client';

import { cn } from '@/lib/utils';
import { useProfileStore } from '@/store/profileStore';
import { useSettingsStore } from '@/store/settingsStore';

interface BadgeProps {
  label: string;
  current: number;
  limit: number;
}

function Badge({ label, current, limit }: BadgeProps) {
  const pct = limit > 0 ? (current / limit) * 100 : 0;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-text-faint">{label}</span>
      <span
        className={cn(
          'text-xs font-bold tabular-nums',
          pct >= 90 ? 'text-red-400' : pct >= 70 ? 'text-yellow-400' : 'text-text-primary'
        )}
      >
        {current}/{limit}
      </span>
    </div>
  );
}

export function DailyLimitBadges() {
  const selectedProfile = useProfileStore((state) => state.selectedProfile);
  const limits = useSettingsStore((state) => state.limits);

  if (!selectedProfile) return null;

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-bg-elevated px-3 py-1.5">
      <Badge label="Visits" current={selectedProfile.daily_visit_count} limit={limits.dailyVisitLimit} />
      <Badge label="Connects" current={selectedProfile.daily_connect_count} limit={limits.dailyConnectLimit} />
      <Badge label="Messages" current={selectedProfile.daily_message_count} limit={limits.dailyMessageLimit} />
      <Badge label="Follows" current={selectedProfile.daily_follow_count} limit={limits.dailyFollowLimit} />
    </div>
  );
}

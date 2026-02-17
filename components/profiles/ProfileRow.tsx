'use client';

import { cn } from '@/lib/utils';
import type { LinkedInProfile } from '@/types';

interface ProfileRowProps {
  profile: LinkedInProfile;
  isSelected: boolean;
  onClick: () => void;
}

const STATUS_DOT: Record<LinkedInProfile['status'], string> = {
  idle: 'bg-slate-400',
  running: 'bg-green-400 animate-pulse',
  paused: 'bg-yellow-400',
  error: 'bg-red-400',
};

export function ProfileRow({ profile, isSelected, onClick }: ProfileRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all',
        isSelected
          ? 'bg-accent/10 border border-accent/30'
          : 'border border-transparent hover:bg-white/5'
      )}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ backgroundColor: profile.avatar_color }}
      >
        {profile.name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-medium text-text-primary">{profile.name}</span>
          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_DOT[profile.status])} />
        </div>
        <span className="block truncate text-[10px] text-text-faint">
          {profile.linkedin_email || profile.adspower_profile_id}
        </span>
      </div>
    </button>
  );
}

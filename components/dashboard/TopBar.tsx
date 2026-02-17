'use client';

import {
  Bot,
  Bug,
  Cable,
  FileSpreadsheet,
  LayoutGrid,
  Settings,
  UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProfileStore } from '@/store/profileStore';
import Link from 'next/link';

const TABS = [
  { id: 'canvas', label: 'Canvas', icon: LayoutGrid },
  { id: 'leads', label: 'Leads', icon: FileSpreadsheet },
  { id: 'logs', label: 'Execution', icon: Cable },
  { id: 'test', label: 'Node Lab', icon: Bug },
] as const;

interface TopBarProps {
  activeTab: 'canvas' | 'leads' | 'logs' | 'test';
  onTabChange: (tab: 'canvas' | 'leads' | 'logs' | 'test') => void;
}

export function TopBar({ activeTab, onTabChange }: TopBarProps) {
  const profiles = useProfileStore((state) => state.profiles);
  const selectedProfile = useProfileStore((state) => state.selectedProfile);
  const selectProfileById = useProfileStore((state) => state.selectProfileById);
  const isProfilesLoading = useProfileStore((state) => state.isLoading);
  const profilesError = useProfileStore((state) => state.error);

  return (
    <header className="relative z-50 flex h-16 items-center justify-between border-b border-white/5 bg-[#0d0d14]/80 px-6 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent shadow-inner">
          <Bot className="h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight text-white">Antigravity</span>
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-accent/80">Command Center</span>
        </div>
      </div>

      <nav className="flex items-center gap-2 rounded-2xl border border-white/5 bg-white/5 p-1.5 backdrop-blur-md">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'group relative flex items-center gap-2.5 overflow-hidden rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-300',
                isActive
                  ? 'bg-accent text-white shadow-glow'
                  : 'text-white/40 hover:bg-white/5 hover:text-white/70'
              )}
            >
              <Icon className={cn(
                "h-4 w-4 transition-transform duration-300 group-hover:scale-110",
                isActive ? "text-white" : "text-white/40 group-hover:text-white/70"
              )} />
              {tab.label}
              {isActive && (
                <span className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-50" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-4">
        {profiles.length > 0 ? (
          <select
            value={selectedProfile?.id ?? ''}
            onChange={(event) => selectProfileById(event.target.value || null)}
            disabled={isProfilesLoading}
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-white/80 outline-none transition hover:bg-white/10 disabled:opacity-40"
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        ) : (
          <Link
            href="/settings/profiles"
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200 transition hover:bg-amber-500/20"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Create Profile
          </Link>
        )}

        <Link
          href="/settings/profiles"
          className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
          title="Manage profiles"
        >
          <Settings className="h-4 w-4" />
        </Link>

        <div className="flex h-2 w-2 animate-pulse rounded-full bg-success" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">System Online</span>
      </div>

      {profilesError && (
        <div className="absolute bottom-1 right-6 text-[10px] text-red-300">
          Profile load error: {profilesError}
        </div>
      )}
    </header>
  );
}

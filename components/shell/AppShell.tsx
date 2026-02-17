'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  Briefcase,
  FileSpreadsheet,
  Inbox,
  LayoutGrid,
  ListChecks,
  Monitor,
  SlidersHorizontal,
  UserPlus,
  UserRoundCog,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProfileStore } from '@/store/profileStore';
import type { NavItemType } from '@/components/untitled/application/app-navigation/config';
import { NavList } from '@/components/untitled/application/app-navigation/base-components/nav-list';
import { UntitledLogoMinimal } from '@/components/untitled/foundations/logo/untitledui-logo-minimal';

const WORKSPACE_NAV: NavItemType[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
  {
    href: '/leads',
    label: 'Leads',
    icon: FileSpreadsheet,
    items: [
      { href: '/leads', label: 'All leads' },
      { href: '/leads/folders', label: 'Folders' },
      { href: '/leads/import', label: 'Import CSV' },
    ],
  },
  { href: '/campaigns', label: 'Campaigns', icon: Briefcase },
  { href: '/unibox', label: 'Unibox', icon: Inbox },
  { href: '/monitor', label: 'Monitor', icon: Monitor },
];

const SYSTEM_NAV: NavItemType[] = [
  { href: '/settings', label: 'Settings', icon: SlidersHorizontal },
  { href: '/settings/profiles', label: 'Profiles', icon: UserRoundCog },
  { href: '/settings/defaults', label: 'Defaults', icon: ListChecks },
];

function isItemActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navActiveUrlFromPath(pathname: string): string {
  if (pathname === '/' || pathname.startsWith('/dashboard')) return '/dashboard';
  if (pathname.startsWith('/leads/import')) return '/leads/import';
  if (pathname.startsWith('/leads/folders')) return '/leads/folders';
  if (pathname.startsWith('/leads')) return '/leads';
  if (pathname.startsWith('/campaigns')) return '/campaigns';
  if (pathname.startsWith('/unibox')) return '/unibox';
  if (pathname.startsWith('/monitor')) return '/monitor';
  if (pathname.startsWith('/settings/profiles')) return '/settings/profiles';
  if (pathname.startsWith('/settings/defaults')) return '/settings/defaults';
  if (pathname.startsWith('/settings')) return '/settings';
  return pathname;
}

function pageMeta(pathname: string): { title: string; subtitle: string } {
  if (pathname === '/dashboard' || pathname === '/') {
    return { title: 'Dashboard', subtitle: 'LinkedIn outreach overview' };
  }
  if (pathname.startsWith('/leads')) {
    return { title: 'Leads Workspace', subtitle: 'Manage list quality, folders, and imports' };
  }
  if (pathname.startsWith('/campaigns')) {
    return { title: 'Campaign Studio', subtitle: 'Plan sequences, launch, and monitor performance' };
  }
  if (pathname.startsWith('/unibox')) {
    return { title: 'Unibox', subtitle: 'Read and sync LinkedIn conversations' };
  }
  if (pathname.startsWith('/monitor')) {
    return { title: 'Live Monitor', subtitle: 'Watch the active browser session in real time' };
  }
  if (pathname.startsWith('/settings')) {
    return { title: 'Settings', subtitle: 'Profiles, limits, and integration controls' };
  }
  return { title: 'Automation Console', subtitle: 'LinkedIn operations control center' };
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const profiles = useProfileStore((state) => state.profiles);
  const selectedProfile = useProfileStore((state) => state.selectedProfile);
  const selectProfileById = useProfileStore((state) => state.selectProfileById);
  const isProfilesLoading = useProfileStore((state) => state.isLoading);
  const { title, subtitle } = pageMeta(pathname);
  const navActiveUrl = navActiveUrlFromPath(pathname);
  const inSettings = pathname.startsWith('/settings');

  return (
    <div className="relative min-h-dvh overflow-hidden bg-bg-base text-text-primary">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 -top-20 h-[24rem] w-[24rem] rounded-full bg-sky-200/45 blur-[120px]" />
        <div className="absolute right-[-5rem] top-12 h-[18rem] w-[18rem] rounded-full bg-emerald-200/35 blur-[120px]" />
      </div>

      <div className="relative flex min-h-dvh">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-slate-50 md:flex md:flex-col">
          <div className="border-b border-slate-200 px-6 py-6">
            <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-md px-0.5">
              <UntitledLogoMinimal className="h-9 w-auto text-slate-900" />
              <div>
                <p className="text-sm font-semibold tracking-tight text-slate-900">Outreach Pro</p>
                <p className="text-xs text-slate-500">LinkedIn outreach suite</p>
              </div>
            </Link>
          </div>

          <div className="px-6 pt-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Main</p>
          </div>
          <NavList activeUrl={navActiveUrl} items={WORKSPACE_NAV} className="mt-1 pt-0" />

          <div className="px-6 pt-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Settings</p>
          </div>
          <NavList activeUrl={navActiveUrl} items={SYSTEM_NAV} className="mt-1 pt-0" />

          <div className="mt-auto border-t border-slate-200 px-6 py-5">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ListChecks className="h-4 w-4 text-slate-400" />
              <span>Workspace ready</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Use Settings to configure profiles and limits.</p>
          </div>
        </aside>

        <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <h1 className="truncate text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
                <p className="text-sm text-slate-500">{subtitle}</p>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                {profiles.length > 0 ? (
                  <select
                    value={selectedProfile?.id ?? ''}
                    onChange={(event) => selectProfileById(event.target.value || null)}
                    disabled={isProfilesLoading}
                    className="max-w-[12rem] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition hover:border-slate-300 disabled:opacity-50 sm:max-w-[14rem]"
                    title="Active LinkedIn profile"
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
                    className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 transition hover:bg-amber-100"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Add Profile
                  </Link>
                )}

                <Link
                  href={inSettings ? '/dashboard' : '/settings'}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 transition hover:bg-slate-50"
                >
                  <UserRoundCog className="h-3.5 w-3.5" />
                  {inSettings ? 'Workspace' : 'Settings'}
                </Link>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto px-4 pb-4 sm:px-6 md:hidden">
              {[...WORKSPACE_NAV, ...SYSTEM_NAV].map((item) => (
                <Link
                  key={item.href}
                  href={item.href ?? '/dashboard'}
                  className={cn(
                    'inline-flex items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-2 text-xs transition',
                    item.href && isItemActive(pathname, item.href)
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600'
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </header>

          <main className="min-h-0 flex-1 p-3 sm:p-4 md:p-6">
            <div className="relative h-full min-h-0 overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
              <div className="relative h-full min-h-0 overflow-hidden">{children}</div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

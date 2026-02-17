'use client';

import Link from 'next/link';
import { ArrowUpRight, ShieldCheck, SlidersHorizontal, Users } from 'lucide-react';

const SETTINGS_LINKS = [
  {
    href: '/settings/profiles',
    label: 'LinkedIn Profiles',
    description: 'Manage identity, proxy config, and AdsPower profile mappings.',
    icon: Users,
  },
  {
    href: '/settings/defaults',
    label: 'Default Limits',
    description: 'Tune daily action caps, delay windows, and guardrails.',
    icon: SlidersHorizontal,
  },
];

export default function SettingsPage() {
  return (
    <div className="h-full overflow-y-auto p-5 md:p-6">
      <div className="mx-auto max-w-5xl">
        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Control Plane</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Settings</h1>
              <p className="mt-2 max-w-2xl text-sm text-text-muted">
                Configure account profiles and execution guardrails. Changes are applied live across the workspace.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                <span className="font-medium">System health: good</span>
              </div>
              <p className="mt-1 text-emerald-600">Profiles and defaults are synchronized.</p>
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {SETTINGS_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 transition hover:border-blue-200 hover:bg-slate-50"
              >
                <div className="absolute right-4 top-4 rounded-full border border-slate-200 p-1 text-slate-400 transition group-hover:border-blue-200 group-hover:text-blue-600">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold tracking-tight text-slate-900 transition group-hover:text-blue-600">
                    {link.label}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-text-muted">{link.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

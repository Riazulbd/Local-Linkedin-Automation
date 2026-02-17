'use client';

import Link from 'next/link';
import { Users, SlidersHorizontal } from 'lucide-react';

const SETTINGS_LINKS = [
  { href: '/settings/profiles', label: 'LinkedIn Profiles', description: 'Manage your LinkedIn accounts and AdsPower browser profiles.', icon: Users },
  { href: '/settings/defaults', label: 'Default Limits', description: 'Configure daily action limits, delays, and working hours.', icon: SlidersHorizontal },
];

export default function SettingsPage() {
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-xl font-bold text-text-primary">Settings</h1>
        <p className="mt-1 text-sm text-text-muted">Configure your automation platform.</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {SETTINGS_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-start gap-4 rounded-xl border border-border bg-bg-surface p-5 transition hover:border-accent/30 hover:bg-bg-elevated"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary group-hover:text-accent transition">{link.label}</h3>
                  <p className="mt-1 text-xs text-text-muted">{link.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

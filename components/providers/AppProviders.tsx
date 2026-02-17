'use client';

import { useEffect, type ReactNode } from 'react';
import { useProfileStore } from '@/store/profileStore';
import { useSettingsStore } from '@/store/settingsStore';

export function AppProviders({ children }: { children: ReactNode }) {
  const initializeProfiles = useProfileStore((state) => state.initialize);
  const initializeSettings = useSettingsStore((state) => state.initialize);

  useEffect(() => {
    initializeProfiles().catch(() => undefined);
    initializeSettings().catch(() => undefined);
  }, [initializeProfiles, initializeSettings]);

  return <>{children}</>;
}

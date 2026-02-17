'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import type { LinkedInProfile } from '@/types';

interface TwoFAContextValue {
  pendingProfiles: LinkedInProfile[];
  isSubmitting: boolean;
  error: string | null;
  submitCode: (profileId: string, code: string) => Promise<void>;
  refreshPendingProfiles: () => Promise<void>;
}

const TwoFAContext = createContext<TwoFAContextValue | null>(null);

export function TwoFAProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);

  const [pendingProfiles, setPendingProfiles] = useState<LinkedInProfile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshPendingProfiles = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from('linkedin_profiles')
      .select('*')
      .eq('login_status', '2fa_pending')
      .order('twofa_requested_at', { ascending: false });

    if (queryError) {
      setError(queryError.message);
      return;
    }

    setPendingProfiles((data ?? []) as LinkedInProfile[]);
  }, [supabase]);

  const submitCode = useCallback(async (profileId: string, code: string) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, code }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to submit 2FA code');
      }

      await refreshPendingProfiles();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to submit 2FA code');
    } finally {
      setIsSubmitting(false);
    }
  }, [refreshPendingProfiles]);

  useEffect(() => {
    refreshPendingProfiles().catch(() => undefined);

    const channel = supabase
      .channel('twofa-global-alerts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'linkedin_profiles' },
        () => {
          refreshPendingProfiles().catch(() => undefined);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(() => undefined);
    };
  }, [refreshPendingProfiles, supabase]);

  const value = useMemo<TwoFAContextValue>(
    () => ({
      pendingProfiles,
      isSubmitting,
      error,
      submitCode,
      refreshPendingProfiles,
    }),
    [pendingProfiles, isSubmitting, error, submitCode, refreshPendingProfiles]
  );

  return <TwoFAContext.Provider value={value}>{children}</TwoFAContext.Provider>;
}

export function useTwoFAContext() {
  const ctx = useContext(TwoFAContext);
  if (!ctx) {
    throw new Error('useTwoFAContext must be used inside TwoFAProvider');
  }
  return ctx;
}

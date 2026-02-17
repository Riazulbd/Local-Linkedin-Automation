'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTwoFAContext } from '@/lib/context/TwoFAContext';

export function GlobalTwoFAAlert() {
  const { pendingProfiles, submitCode, isSubmitting, error } = useTwoFAContext();
  const [codes, setCodes] = useState<Record<string, string>>({});

  const pending = useMemo(
    () => pendingProfiles.filter((profile) => profile.login_status === '2fa_pending'),
    [pendingProfiles]
  );

  if (!pending.length) {
    return null;
  }

  return (
    <div className="fixed right-4 top-4 z-[80] w-[24rem] max-w-[calc(100vw-2rem)] space-y-2">
      {pending.map((profile) => (
        <div
          key={profile.id}
          className="rounded-lg border border-amber-400/60 bg-amber-500/10 p-3 shadow-xl backdrop-blur"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-200" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-amber-100">2FA Required</p>
              <p className="mt-0.5 text-xs text-amber-200/90">
                {profile.name} needs a {profile.twofa_challenge_type || 'verification'} code.
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  value={codes[profile.id] || ''}
                  onChange={(event) =>
                    setCodes((prev) => ({
                      ...prev,
                      [profile.id]: event.target.value,
                    }))
                  }
                  placeholder="Enter code"
                  className="flex-1 rounded-md border border-amber-300/40 bg-black/20 px-2 py-1 text-xs text-amber-50 placeholder:text-amber-200/60 outline-none"
                />
                <button
                  type="button"
                  disabled={isSubmitting || !(codes[profile.id] || '').trim()}
                  onClick={() => {
                    const code = (codes[profile.id] || '').trim();
                    if (!code) return;
                    submitCode(profile.id, code).catch(() => undefined);
                    setCodes((prev) => ({ ...prev, [profile.id]: '' }));
                  }}
                  className="rounded-md border border-amber-300/50 px-2 py-1 text-xs text-amber-100 hover:bg-amber-500/20 disabled:opacity-60"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}

      {error && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-200">{error}</p>
      )}
    </div>
  );
}

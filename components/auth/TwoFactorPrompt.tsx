'use client';

import { useState } from 'react';

interface TwoFactorPromptProps {
  defaultProfileId?: string | null;
}

export function TwoFactorPrompt({ defaultProfileId = '' }: TwoFactorPromptProps) {
  const [profileId, setProfileId] = useState(defaultProfileId || '');
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitCode(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (!profileId.trim() || !code.trim()) {
      setError('profileId and code are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: profileId.trim(), code: code.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Failed to submit 2FA code');
      setMessage('2FA code submitted');
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit 2FA code');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={submitCode} className="rounded-xl border border-white/10 bg-white/5 p-4">
      <h3 className="text-sm font-semibold text-white">Two-Factor Code</h3>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <input
          value={profileId}
          onChange={(event) => setProfileId(event.target.value)}
          placeholder="Profile ID"
          className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-sm text-white placeholder:text-white/35"
        />
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Verification code"
          className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-sm text-white placeholder:text-white/35"
        />
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-3 rounded-md border border-cyan-400/40 px-2.5 py-1 text-xs text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-60"
      >
        {isSubmitting ? 'Submitting...' : 'Submit 2FA Code'}
      </button>

      {message && <p className="mt-2 text-xs text-emerald-300">{message}</p>}
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </form>
  );
}

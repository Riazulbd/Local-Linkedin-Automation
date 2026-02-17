'use client';

import { useState } from 'react';

interface LinkedInLoginFormProps {
  defaultProfileId?: string | null;
  onSuccess?: () => void;
}

export function LinkedInLoginForm({ defaultProfileId = '', onSuccess }: LinkedInLoginFormProps) {
  const [profileId, setProfileId] = useState(defaultProfileId || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!profileId.trim() || !email.trim() || !password) {
      setError('profileId, email, and password are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: profileId.trim(),
          email: email.trim(),
          password,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Failed to start login');

      setMessage(payload.success ? 'Login successful' : 'Login started, check 2FA prompt if required');
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start login');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-900">LinkedIn Login</h3>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <input
          value={profileId}
          onChange={(event) => setProfileId(event.target.value)}
          placeholder="Profile ID"
          className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400"
        />
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="LinkedIn email"
          className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400"
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="LinkedIn password"
          className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400"
        />
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-3 rounded-md border border-cyan-400/40 px-2.5 py-1 text-xs text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-60"
      >
        {isSubmitting ? 'Starting login...' : 'Start Login'}
      </button>

      {message && <p className="mt-2 text-xs text-emerald-300">{message}</p>}
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </form>
  );
}

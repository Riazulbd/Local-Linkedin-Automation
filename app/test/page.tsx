'use client';

import { useEffect, useMemo, useState } from 'react';
import { LiveLogStream } from '@/components/logs/LiveLogStream';
import { useProfileStore } from '@/store/profileStore';
import type { Lead } from '@/types';

type TestAction = 'visit' | 'connect' | 'message' | 'follow';

export default function TestPage() {
  const profiles = useProfileStore((state) => state.profiles);
  const selectedProfile = useProfileStore((state) => state.selectedProfile);
  const selectProfileById = useProfileStore((state) => state.selectProfileById);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [runId, setRunId] = useState<string | null>(null);
  const [runningAction, setRunningAction] = useState<TestAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const profileId = useMemo(() => selectedProfile?.id || '', [selectedProfile?.id]);
  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === selectedLeadId) ?? null,
    [leads, selectedLeadId]
  );

  useEffect(() => {
    if (!profileId) {
      setLeads([]);
      setSelectedLeadId('');
      return;
    }

    fetch(`/api/leads?profileId=${encodeURIComponent(profileId)}&limit=50`, { cache: 'no-store' })
      .then((response) => response.json().catch(() => ({})))
      .then((payload) => {
        const nextLeads = (payload.leads ?? payload.data ?? []) as Lead[];
        setLeads(nextLeads);
        setSelectedLeadId((current) => {
          if (current && nextLeads.some((lead) => lead.id === current)) return current;
          return nextLeads[0]?.id ?? '';
        });
      })
      .catch(() => {
        setLeads([]);
        setSelectedLeadId('');
      });
  }, [profileId]);

  async function runTest(action: TestAction) {
    if (!profileId) {
      setError('Please select a profile');
      return;
    }

    if (!selectedLead?.id) {
      setError('Please select a lead');
      return;
    }

    setError(null);
    setRunningAction(action);

    try {
      const response = await fetch('/api/automation/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          profileId,
          leadId: selectedLead.id,
          nodeType:
            action === 'visit'
              ? 'visit_profile'
              : action === 'connect'
                ? 'send_connection'
                : action === 'message'
                  ? 'send_message'
                  : 'follow_profile',
          nodeData:
            action === 'message'
              ? { messageTemplate: 'Hi {{firstName}}, this is a test message.' }
              : {},
          messageTemplate: action === 'message' ? 'Hi {{firstName}}, this is a test message.' : undefined,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to start test');
      }

      setRunId(payload.runId || null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to run test');
    } finally {
      setRunningAction(null);
    }
  }

  return (
    <div className="space-y-4 p-6" data-animate="page">
      <h1 className="text-xl font-semibold text-text-primary">Automation Test Mode</h1>

      <div className="grid gap-3 rounded-xl border border-border bg-bg-surface p-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          Profile
          <select
            value={profileId}
            onChange={(event) => selectProfileById(event.target.value || null)}
            className="rounded-md border border-border bg-bg-base px-2.5 py-2 text-sm text-text-primary outline-none focus:border-accent"
          >
            <option value="">Select profile</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-text-muted">
          Lead
          <select
            value={selectedLeadId}
            onChange={(event) => setSelectedLeadId(event.target.value)}
            className="rounded-md border border-border bg-bg-base px-2.5 py-2 text-sm text-text-primary outline-none focus:border-accent"
          >
            <option value="">Select lead</option>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {`${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unnamed lead'} -{' '}
                {lead.company || 'No company'}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedLead && (
        <div className="rounded-md border border-border bg-bg-surface px-3 py-2 text-xs text-text-muted">
          Target URL:{' '}
          <a href={selectedLead.linkedin_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
            {selectedLead.linkedin_url}
          </a>
        </div>
      )}

      {error && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => runTest('visit')}
          disabled={Boolean(runningAction) || !selectedLead}
          className="rounded-lg border border-border bg-bg-panel px-4 py-2 text-xs font-medium text-text-primary hover:border-accent disabled:opacity-60"
        >
          {runningAction === 'visit' ? 'Running Visit...' : 'Test Visit'}
        </button>
        <button
          type="button"
          onClick={() => runTest('connect')}
          disabled={Boolean(runningAction) || !selectedLead}
          className="rounded-lg border border-border bg-bg-panel px-4 py-2 text-xs font-medium text-text-primary hover:border-accent disabled:opacity-60"
        >
          {runningAction === 'connect' ? 'Running Connect...' : 'Test Connect'}
        </button>
        <button
          type="button"
          onClick={() => runTest('message')}
          disabled={Boolean(runningAction) || !selectedLead}
          className="rounded-lg border border-border bg-bg-panel px-4 py-2 text-xs font-medium text-text-primary hover:border-accent disabled:opacity-60"
        >
          {runningAction === 'message' ? 'Running Message...' : 'Test Message'}
        </button>
        <button
          type="button"
          onClick={() => runTest('follow')}
          disabled={Boolean(runningAction) || !selectedLead}
          className="rounded-lg border border-border bg-bg-panel px-4 py-2 text-xs font-medium text-text-primary hover:border-accent disabled:opacity-60"
        >
          {runningAction === 'follow' ? 'Running Follow...' : 'Test Follow'}
        </button>
      </div>

      {runId && <LiveLogStream runId={runId} />}
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import type { Lead, LeadFolder } from '@/types';

interface LeadFolderAssignDialogProps {
  folder: LeadFolder | null;
  leads: Lead[];
  onAssign: (leadIds: string[]) => Promise<void>;
}

export function LeadFolderAssignDialog({ folder, leads, onAssign }: LeadFolderAssignDialogProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(() => leads.filter((lead) => lead.status !== 'completed'), [leads]);

  function toggleLead(leadId: string) {
    setSelected((prev) => (prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]));
  }

  async function handleAssign() {
    if (!folder) return;
    if (!selected.length) {
      setError('Select at least one lead');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onAssign(selected);
      setSelected([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign leads');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg border border-white/10 bg-white/5 p-3">
      <h3 className="text-sm font-semibold text-white">Assign Leads to Folder</h3>
      <p className="mt-1 text-xs text-white/60">
        Target folder: <span className="font-medium text-white">{folder?.name || 'None selected'}</span>
      </p>

      <div className="mt-2 max-h-56 space-y-1 overflow-auto rounded-md border border-white/10 p-2">
        {options.map((lead) => (
          <label key={lead.id} className="flex items-center gap-2 text-xs text-white/80">
            <input
              type="checkbox"
              checked={selected.includes(lead.id)}
              onChange={() => toggleLead(lead.id)}
            />
            <span className="truncate">
              {lead.first_name || 'Lead'} {lead.last_name || ''} - {lead.linkedin_url}
            </span>
          </label>
        ))}
      </div>

      <button
        type="button"
        disabled={!folder || isSubmitting}
        onClick={handleAssign}
        className="mt-3 rounded-md border border-cyan-400/40 px-2.5 py-1 text-xs text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-50"
      >
        {isSubmitting ? 'Assigning...' : 'Assign Selected Leads'}
      </button>

      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </section>
  );
}

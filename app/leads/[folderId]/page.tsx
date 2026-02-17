'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import { useParams } from 'next/navigation';
import { CSVImportMapper } from '@/components/leads-folders/CSVImportMapper';
import { useProfileStore } from '@/store/profileStore';
import type { ColumnMapping, CSVLeadRow, Lead, LeadFolder } from '@/types';

type LeadFilterStatus = 'all' | Lead['status'];

function guessField(header: string): ColumnMapping['field'] {
  const normalized = header.trim().toLowerCase();
  if (normalized.includes('linkedin') || normalized.includes('profile url')) return 'linkedin_url';
  if (normalized.includes('first')) return 'first_name';
  if (normalized.includes('last')) return 'last_name';
  if (normalized.includes('company')) return 'company';
  if (normalized.includes('title')) return 'title';
  return 'ignore';
}

function inferMapping(rows: CSVLeadRow[]): ColumnMapping[] {
  if (!rows.length) return [];
  return Object.keys(rows[0]).map((header) => ({
    csv_header: header,
    field: guessField(header),
  }));
}

export default function LeadFolderDetailPage() {
  const params = useParams<{ folderId: string }>();
  const folderId = String(params?.folderId || '');
  const selectedProfile = useProfileStore((state) => state.selectedProfile);

  const [folder, setFolder] = useState<LeadFolder | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [statusFilter, setStatusFilter] = useState<LeadFilterStatus>('all');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showImport, setShowImport] = useState(false);
  const [csvRows, setCsvRows] = useState<CSVLeadRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadFolder() {
    if (!folderId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [folderRes, leadsRes] = await Promise.all([
        fetch(`/api/lead-folders/${folderId}`, { cache: 'no-store' }),
        fetch(`/api/lead-folders/${folderId}/leads`, { cache: 'no-store' }),
      ]);

      const folderPayload = await folderRes.json().catch(() => ({}));
      const leadsPayload = await leadsRes.json().catch(() => ({}));

      if (!folderRes.ok) throw new Error(folderPayload.error || 'Failed to load folder');
      if (!leadsRes.ok) throw new Error(leadsPayload.error || 'Failed to load folder leads');

      setFolder(folderPayload.folder ?? null);
      setLeads(leadsPayload.leads ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load folder');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadFolder().catch(() => undefined);
  }, [folderId]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
      const query = search.trim().toLowerCase();
      const haystack = [
        lead.first_name || '',
        lead.last_name || '',
        lead.company || '',
        lead.title || '',
        lead.linkedin_url || '',
      ]
        .join(' ')
        .toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [leads, search, statusFilter]);

  function onFileSelected(file: File) {
    setError(null);
    setMessage(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const parsed = (result.data as Record<string, string>[]).map((row) => row as CSVLeadRow);
        setCsvRows(parsed);
        setMapping(inferMapping(parsed));
      },
      error: (parseError) => {
        setError(parseError.message);
      },
    });
  }

  async function importCsv() {
    if (!selectedProfile?.id) {
      setError('Select a profile first before importing leads');
      return;
    }
    if (!csvRows.length) {
      setError('Upload a CSV file first');
      return;
    }

    const effectiveMapping = mapping.length ? mapping : inferMapping(csvRows);
    const mappedRows = csvRows.map((row) => {
      const mapped: CSVLeadRow = { linkedin_url: '' };
      for (const item of effectiveMapping) {
        if (item.field === 'ignore') continue;
        mapped[item.field] = row[item.csv_header];
      }
      return mapped;
    });

    const leadsPayload = mappedRows
      .filter((row) => typeof row.linkedin_url === 'string' && row.linkedin_url.trim().length > 0)
      .map((row) => ({
        linkedin_url: row.linkedin_url.trim(),
        first_name: row.first_name?.trim() || '',
        last_name: row.last_name?.trim() || '',
        company: row.company?.trim() || '',
        title: row.title?.trim() || '',
      }));

    if (!leadsPayload.length) {
      setError('No valid linkedin_url values found after mapping');
      return;
    }

    setIsImporting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/leads/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: selectedProfile.id,
          folderId,
          leads: leadsPayload,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to import CSV');

      setMessage(`Imported ${payload.inserted ?? leadsPayload.length} leads`);
      setShowImport(false);
      setCsvRows([]);
      setMapping([]);
      await loadFolder();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Failed to import CSV');
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/leads" className="text-xs text-slate-500 hover:text-slate-700">
            Back to folders
          </Link>
          <h1 className="text-xl font-semibold text-slate-900">{folder?.name || 'Folder'}</h1>
          <p className="text-sm text-slate-500">
            {folder?.description || 'Leads in this folder are ready to be attached to campaigns.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowImport(true)}
          className="rounded-md border border-cyan-400/40 px-3 py-1.5 text-sm text-cyan-200 hover:bg-cyan-500/20"
        >
          Import CSV
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-[220px_1fr]">
        <label className="text-xs text-slate-600">
          Status
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as LeadFilterStatus)}
            className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-900"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="skipped">Skipped</option>
          </select>
        </label>
        <label className="text-xs text-slate-600">
          Search
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, company, title, URL"
            className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-900"
          />
        </label>
      </div>

      {isLoading && <p className="text-sm text-slate-500">Loading folder...</p>}
      {error && <p className="text-sm text-rose-300">{error}</p>}
      {message && <p className="text-sm text-emerald-300">{message}</p>}

      <div className="overflow-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-left text-sm text-slate-700">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">LinkedIn URL</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Added</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.map((lead) => (
              <tr key={lead.id} className="border-t border-slate-200">
                <td className="px-3 py-2">{`${lead.first_name || ''} ${lead.last_name || ''}`.trim() || '-'}</td>
                <td className="px-3 py-2">{lead.company || '-'}</td>
                <td className="px-3 py-2">{lead.title || '-'}</td>
                <td className="px-3 py-2">
                  <a
                    href={lead.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-300 hover:underline"
                  >
                    {lead.linkedin_url}
                  </a>
                </td>
                <td className="px-3 py-2">{lead.status}</td>
                <td className="px-3 py-2">{new Date(lead.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {!filteredLeads.length && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
                  No leads found for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Import CSV to {folder?.name || 'folder'}</h2>
                <p className="text-xs text-slate-500">
                  Map CSV columns to lead fields. `linkedin_url` is required.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowImport(false)}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="mt-3 space-y-3">
              <label className="text-xs text-slate-600">
                CSV File
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onFileSelected(file);
                  }}
                  className="mt-1 block text-xs text-slate-700"
                />
              </label>

              <CSVImportMapper rows={csvRows.slice(0, 5)} onChange={setMapping} />

              {!selectedProfile?.id && (
                <p className="text-xs text-amber-500">
                  Select a profile from the sidebar before importing leads.
                </p>
              )}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowImport(false)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isImporting || !csvRows.length}
                  onClick={() => importCsv().catch(() => undefined)}
                  className="rounded-md border border-cyan-400/40 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-60"
                >
                  {isImporting ? 'Importing...' : 'Import Leads'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

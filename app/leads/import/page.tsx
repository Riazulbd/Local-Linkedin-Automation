'use client';

import { useMemo, useState } from 'react';
import Papa from 'papaparse';
import type { ColumnMapping, CSVLeadRow } from '@/types';
import { CSVImportMapper } from '@/components/leads-folders/CSVImportMapper';
import { useProfileStore } from '@/store/profileStore';

export default function LeadImportPage() {
  const selectedProfile = useProfileStore((state) => state.selectedProfile);

  const [rows, setRows] = useState<CSVLeadRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewRows = useMemo(() => rows.slice(0, 5), [rows]);

  function onFileSelected(file: File) {
    setError(null);
    setMessage(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const parsed = (result.data as Record<string, string>[]).map((row) => row as CSVLeadRow);
        setRows(parsed);
      },
      error: (err) => {
        setError(err.message);
      },
    });
  }

  async function uploadMappedRows() {
    if (!selectedProfile?.id) {
      setError('Select a profile before importing leads');
      return;
    }
    if (!rows.length) {
      setError('Upload a CSV first');
      return;
    }

    const mappedRows = rows.map((row) => {
      const mapped: CSVLeadRow = { linkedin_url: '' };
      for (const map of mapping) {
        if (map.field === 'ignore') continue;
        mapped[map.field] = row[map.csv_header];
      }
      return mapped;
    });

    const leads = mappedRows
      .filter((row) => row.linkedin_url && row.linkedin_url.includes('linkedin.com/in/'))
      .map((row) => ({
        linkedin_url: row.linkedin_url,
        first_name: row.first_name,
        last_name: row.last_name,
        company: row.company,
        title: row.title,
      }));

    if (!leads.length) {
      setError('No valid LinkedIn profile URLs found after mapping');
      return;
    }

    setIsUploading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/leads/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: selectedProfile.id,
          leads,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Failed to upload leads');
      setMessage(`Uploaded ${payload.inserted} leads.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload leads');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">CSV Lead Import</h1>
        <p className="text-sm text-slate-500">
          Parse CSV, map columns, and bulk upload leads into selected profile.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
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
      </div>

      <CSVImportMapper rows={previewRows} onChange={setMapping} />

      <button
        type="button"
        onClick={uploadMappedRows}
        disabled={isUploading}
        className="rounded-md border border-cyan-400/40 px-3 py-1.5 text-sm text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-60"
      >
        {isUploading ? 'Uploading...' : 'Upload Leads'}
      </button>

      {message && <p className="text-sm text-emerald-300">{message}</p>}
      {error && <p className="text-sm text-rose-300">{error}</p>}
    </main>
  );
}

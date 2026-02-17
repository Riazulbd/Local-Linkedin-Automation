'use client';

import Papa from 'papaparse';
import { UploadCloud, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { useMemo, useState, type DragEvent } from 'react';
import { useProfileStore } from '@/store/profileStore';

interface ParsedLead {
  linkedin_url: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  title?: string;
  extra_data: Record<string, string>;
}

interface LeadsUploadProps {
  onUploaded: () => void;
}

const REQUIRED_COLUMNS = ['linkedin_url'];
const OPTIONAL_COLUMNS = ['first_name', 'last_name', 'company', 'title'];

function normalizeHeader(value: string) {
  return value.trim().toLowerCase();
}

export function LeadsUpload({ onUploaded }: LeadsUploadProps) {
  const selectedProfile = useProfileStore((state) => state.selectedProfile);
  const [rows, setRows] = useState<ParsedLead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const preview = useMemo(() => rows.slice(0, 5), [rows]);

  const parseFile = (file: File) => {
    setError(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normalizeHeader,
      complete: (result) => {
        const headers = (result.meta.fields ?? []).map(normalizeHeader);
        const missing = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));

        if (missing.length) {
          setRows([]);
          setError(`Missing required column(s): ${missing.join(', ')}`);
          return;
        }

        const normalized: ParsedLead[] = result.data
          .map((row) => {
            const linkedin_url = row.linkedin_url?.trim();
            if (!linkedin_url) return null;

            const lead: ParsedLead = {
              linkedin_url,
              first_name: row.first_name?.trim() || '',
              last_name: row.last_name?.trim() || '',
              company: row.company?.trim() || '',
              title: row.title?.trim() || '',
              extra_data: {},
            };

            for (const [key, value] of Object.entries(row)) {
              if (!REQUIRED_COLUMNS.includes(key) && !OPTIONAL_COLUMNS.includes(key)) {
                lead.extra_data[key] = value ?? '';
              }
            }

            return lead;
          })
          .filter((lead): lead is ParsedLead => Boolean(lead));

        setRows(normalized);
      },
      error: (parseError) => {
        setError(parseError.message);
      },
    });
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (file) parseFile(file);
  };

  const startUpload = async () => {
    if (!rows.length || !selectedProfile) return;

    setIsUploading(true);
    setProgress(5);
    setError(null);

    const progressTimer = setInterval(() => {
      setProgress((current) => Math.min(current + 7, 90));
    }, 180);

    try {
      const response = await fetch('/api/leads/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: selectedProfile.id,
          leads: rows,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(payload.error || `Upload failed: ${response.status}`);
      }

      setProgress(100);
      setRows([]);
      onUploaded();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed');
    } finally {
      clearInterval(progressTimer);
      setTimeout(() => {
        setIsUploading(false);
        setProgress(0);
      }, 250);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <FileSpreadsheet className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-semibold">Upload Leads CSV</h3>
      </div>

      <label
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center transition ${
          isDragging ? 'border-accent bg-accent/10' : 'border-border bg-bg-base'
        }`}
      >
        <UploadCloud className="h-8 w-8 text-accent" />
        <p className="mt-3 text-sm text-text-primary">Drag and drop a CSV file here</p>
        <p className="mt-1 text-xs text-text-muted">or click to choose a file</p>
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) parseFile(file);
          }}
        />
      </label>

      <p className="mt-3 text-[11px] text-text-faint">
        Required: <span className="mono">linkedin_url</span>. Optional: <span className="mono">first_name, last_name, company, title</span>.
      </p>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5" />
          <span>{error}</span>
        </div>
      )}

      {!selectedProfile && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5" />
          <span>Select a profile before uploading leads.</span>
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-border bg-bg-base p-3">
            <p className="text-xs font-medium text-text-primary">Parsed {rows.length} lead(s)</p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead className="text-text-muted">
                  <tr>
                    <th className="pb-1.5">linkedin_url</th>
                    <th className="pb-1.5">first_name</th>
                    <th className="pb-1.5">last_name</th>
                    <th className="pb-1.5">company</th>
                    <th className="pb-1.5">title</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, index) => (
                    <tr key={`${row.linkedin_url}-${index}`} className="border-t border-border/70 text-text-primary">
                      <td className="py-1.5 pr-2">{row.linkedin_url}</td>
                      <td className="py-1.5 pr-2">{row.first_name || '-'}</td>
                      <td className="py-1.5 pr-2">{row.last_name || '-'}</td>
                      <td className="py-1.5 pr-2">{row.company || '-'}</td>
                      <td className="py-1.5">{row.title || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 5 && <p className="mt-2 text-[11px] text-text-faint">Showing first 5 rows.</p>}
          </div>

          {isUploading && (
            <div className="h-2 overflow-hidden rounded-full bg-bg-elevated">
              <div
                className="h-full rounded-full bg-accent transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          <button
            type="button"
            onClick={startUpload}
            disabled={isUploading || !selectedProfile}
            className="rounded-md bg-accent px-3 py-2 text-xs font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUploading ? 'Uploading...' : 'Confirm Upload'}
          </button>
        </div>
      )}
    </section>
  );
}

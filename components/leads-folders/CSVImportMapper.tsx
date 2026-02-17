'use client';

import { useMemo, useState } from 'react';
import type { CSVLeadRow, ColumnMapping } from '@/types';

const FIELD_OPTIONS: Array<ColumnMapping['field']> = [
  'linkedin_url',
  'first_name',
  'last_name',
  'company',
  'title',
  'ignore',
];

interface CSVImportMapperProps {
  rows: CSVLeadRow[];
  onChange: (mapping: ColumnMapping[]) => void;
}

export function CSVImportMapper({ rows, onChange }: CSVImportMapperProps) {
  const headers = useMemo(() => {
    if (!rows.length) return [];
    return Object.keys(rows[0]);
  }, [rows]);

  const [mapping, setMapping] = useState<ColumnMapping[]>(() =>
    headers.map((header) => ({ csv_header: header, field: guessField(header) }))
  );

  function updateField(csvHeader: string, field: ColumnMapping['field']) {
    const next = mapping.map((row) => (row.csv_header === csvHeader ? { ...row, field } : row));
    setMapping(next);
    onChange(next);
  }

  if (!headers.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
        No CSV preview rows yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <h3 className="text-sm font-semibold text-slate-900">CSV Column Mapper</h3>
      <div className="mt-2 overflow-auto rounded-md border border-slate-200">
        <table className="min-w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 text-slate-400">
            <tr>
              <th className="px-3 py-2">CSV Header</th>
              <th className="px-3 py-2">Map To</th>
            </tr>
          </thead>
          <tbody>
            {headers.map((header) => (
              <tr key={header} className="border-t border-slate-200">
                <td className="px-3 py-2 font-mono text-[11px]">{header}</td>
                <td className="px-3 py-2">
                  <select
                    value={mapping.find((row) => row.csv_header === header)?.field || 'ignore'}
                    onChange={(event) => updateField(header, event.target.value as ColumnMapping['field'])}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-900"
                  >
                    {FIELD_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function guessField(header: string): ColumnMapping['field'] {
  const normalized = header.trim().toLowerCase();
  if (normalized.includes('linkedin') || normalized.includes('profile url')) return 'linkedin_url';
  if (normalized.includes('first')) return 'first_name';
  if (normalized.includes('last')) return 'last_name';
  if (normalized.includes('company')) return 'company';
  if (normalized.includes('title')) return 'title';
  return 'ignore';
}

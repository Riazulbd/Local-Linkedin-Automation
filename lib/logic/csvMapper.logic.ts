import type { CSVImportPayload, CSVLeadRow, ColumnMapping, CreateLeadInput } from '@/types';

type MappedLeadDraft = Omit<CreateLeadInput, 'profile_id'> & {
  raw: CSVLeadRow;
};

const RESERVED_FIELDS = new Set([
  'linkedin_url',
  'first_name',
  'last_name',
  'company',
  'title',
]);

export function applyColumnMapping(rows: CSVLeadRow[], mapping: ColumnMapping[]): CSVLeadRow[] {
  if (!mapping.length) return rows;

  return rows.map((row) => {
    const mapped: CSVLeadRow = { linkedin_url: '' };
    for (const map of mapping) {
      if (map.field === 'ignore') continue;
      const value = row[map.csv_header];
      if (value == null) continue;
      mapped[map.field] = value;
    }
    return mapped;
  });
}

export function mapRowsToLeadDrafts(rows: CSVLeadRow[]): MappedLeadDraft[] {
  return rows
    .filter((row) => typeof row.linkedin_url === 'string' && row.linkedin_url.trim().length > 0)
    .map((row) => {
      const extraData: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        if (!value || RESERVED_FIELDS.has(key)) continue;
        extraData[key] = value;
      }

      return {
        linkedin_url: row.linkedin_url.trim(),
        first_name: row.first_name?.trim() || undefined,
        last_name: row.last_name?.trim() || undefined,
        company: row.company?.trim() || undefined,
        title: row.title?.trim() || undefined,
        extra_data: extraData,
        raw: row,
      };
    });
}

export function convertImportPayloadToLeadInserts(
  payload: CSVImportPayload,
  profileId: string
): CreateLeadInput[] {
  const mappedRows = applyColumnMapping(payload.rows, payload.mapping);
  const drafts = mapRowsToLeadDrafts(mappedRows);

  return drafts.map((draft) => ({
    profile_id: profileId,
    linkedin_url: draft.linkedin_url,
    first_name: draft.first_name,
    last_name: draft.last_name,
    company: draft.company,
    title: draft.title,
    extra_data: {
      ...draft.extra_data,
      folder_id: payload.folder_id,
    },
  }));
}

export interface LeadFolder {
  id: string;
  name: string;
  description: string | null;
  lead_count: number;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface CreateFolderInput {
  name: string;
  description?: string;
  color?: string;
}

export interface ColumnMapping {
  csv_header: string;
  field: keyof CSVLeadRow | 'ignore';
}

export interface CSVLeadRow {
  linkedin_url: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  title?: string;
  [key: string]: string | undefined;
}

export interface CSVImportPayload {
  folder_id: string;
  rows: CSVLeadRow[];
  mapping: ColumnMapping[];
}

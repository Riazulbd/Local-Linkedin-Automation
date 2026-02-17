import type { CreateLeadInput } from '@/types';

export interface ParsedCSVRow {
  linkedin_url: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  title?: string;
  [key: string]: string | undefined;
}

export function parseCSVToLeads(rows: ParsedCSVRow[], profileId: string): CreateLeadInput[] {
  return rows
    .filter(row => row.linkedin_url?.includes('linkedin.com/in/'))
    .map(({ linkedin_url, first_name, last_name, company, title, ...extra }) => ({
      profile_id: profileId,
      linkedin_url: linkedin_url.trim(),
      first_name: first_name?.trim() || undefined,
      last_name: last_name?.trim() || undefined,
      company: company?.trim() || undefined,
      title: title?.trim() || undefined,
      extra_data: Object.fromEntries(
        Object.entries(extra).filter(([_, v]) => v !== undefined)
      ) as Record<string, string>,
    }));
}

export function validateLinkedInUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9\-_%]+\/?/.test(url.trim());
}

export type LeadStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface Lead {
  id: string;
  profile_id: string;
  linkedin_url: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  title: string | null;
  folder_id?: string | null;
  notes?: string | null;
  connection_degree?: '1st' | '2nd' | '3rd' | 'pending' | 'not_connected' | 'unknown' | null;
  extra_data: Record<string, string>;
  status: LeadStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateLeadInput {
  profile_id: string;
  linkedin_url: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  title?: string;
  folder_id?: string | null;
  notes?: string;
  extra_data?: Record<string, string>;
}

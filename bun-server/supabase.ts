import { createClient } from '@supabase/supabase-js';
import type { Lead, ExecutionLog, ExecutionRun, LinkedInProfile } from '../types';

export interface Database {
  public: {
    Tables: {
      leads: {
        Row: Lead;
        Insert: Partial<Lead>;
        Update: Partial<Lead>;
      };
      execution_logs: {
        Row: ExecutionLog;
        Insert: Omit<ExecutionLog, 'id' | 'created_at'>;
        Update: Partial<ExecutionLog>;
      };
      execution_runs: {
        Row: ExecutionRun;
        Insert: Omit<ExecutionRun, 'id' | 'started_at' | 'completed_at' | 'leads_completed' | 'leads_failed'>;
        Update: Partial<ExecutionRun>;
      };
      linkedin_profiles: {
        Row: LinkedInProfile;
        Insert: Partial<LinkedInProfile>;
        Update: Partial<LinkedInProfile>;
      };
    };
  };
}

type LooseSupabaseClient = ReturnType<typeof createClient<any, 'public', any>>;

let cachedClient: LooseSupabaseClient | null = null;

export function getSupabaseClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for Bun server');
  }

  cachedClient = createClient<any, 'public', any>(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedClient;
}

export interface LinkedInProfile {
  id: string;
  name: string;
  linkedin_email: string | null;
  adspower_profile_id: string;
  brightdata_host: string | null;
  brightdata_port: number | null;
  brightdata_username: string | null;
  brightdata_password: string | null;
  status: 'idle' | 'running' | 'paused' | 'error';
  daily_visit_count: number;
  daily_connect_count: number;
  daily_message_count: number;
  daily_follow_count: number;
  last_reset_date: string | null;
  last_run_at: string | null;
  avatar_color: string;
  created_at: string;
  updated_at: string;
}

export type ProfileStatus = LinkedInProfile['status'];

export interface CreateProfileInput {
  name: string;
  linkedin_email?: string;
  adspower_profile_id: string;
  brightdata_host?: string;
  brightdata_port?: number;
  brightdata_username?: string;
  brightdata_password?: string;
  avatar_color?: string;
}

export interface UpdateProfileInput extends Partial<CreateProfileInput> {
  status?: ProfileStatus;
}

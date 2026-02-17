export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';
export type StepProgressStatus = 'pending' | 'in_progress' | 'waiting' | 'completed' | 'failed' | 'skipped';

export type CampaignStepType =
  | 'visit_profile'
  | 'send_connection'
  | 'send_message'
  | 'follow_profile'
  | 'wait_days'
  | 'check_connected'
  | 'withdraw_connection';

export interface CampaignStep {
  id: string;
  type: CampaignStepType;
  order: number;
  config: {
    dwellSeconds?: { min: number; max: number };
    connectionNote?: string;
    messageTemplate?: string;
    days?: number;
    afterDays?: number;
  };
  label?: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  sequence: CampaignStep[];
  daily_new_leads: number;
  created_at: string;
  updated_at: string;
  profiles?: import('./profile.types').LinkedInProfile[];
  folder_ids?: string[];
}

export interface CampaignLeadProgress {
  id: string;
  campaign_id: string;
  lead_id: string;
  profile_id: string;
  current_step: number;
  status: StepProgressStatus;
  next_action_at: string | null;
  last_action_at: string | null;
  step_results: Array<{ step: number; result: string; at: string }>;
  created_at: string;
  updated_at: string;
}

export interface CreateCampaignInput {
  name: string;
  description?: string;
  sequence: CampaignStep[];
  daily_new_leads?: number;
  profile_ids: string[];
  folder_ids: string[];
}

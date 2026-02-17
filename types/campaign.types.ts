export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';

export type StepType =
  | 'visit_profile'
  | 'send_connection'
  | 'send_message'
  | 'follow_profile'
  | 'wait_days'
  | 'check_connection'
  | 'if_condition';

export interface CampaignStep {
  id: string;
  campaign_id?: string;
  step_order: number;
  step_type: StepType;
  config: Record<string, unknown>;
  created_at?: string;
  // Compatibility for existing UI/editor code.
  type?: StepType;
  order?: number;
  label?: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  folder_id: string | null;
  daily_new_leads: number;
  respect_working_hrs: boolean;
  total_leads: number;
  contacted_leads: number;
  replied_leads: number;
  created_at: string;
  updated_at: string;
  steps?: CampaignStep[];
  profiles?: string[];
  // Compatibility for current UI/API shapes.
  sequence?: CampaignStep[];
  profile_ids?: string[];
  folder_ids?: string[];
}

export type LeadProgressStatus = 'pending' | 'active' | 'waiting' | 'completed' | 'failed' | 'opted_out';

export interface CampaignLeadProgress {
  id: string;
  campaign_id: string;
  lead_id: string;
  profile_id: string;
  current_step: number;
  status: LeadProgressStatus;
  next_action_at: string | null;
  last_action_at: string | null;
  created_at?: string;
  updated_at?: string;
}

// Compatibility aliases for legacy workflow/campaign UI code paths.
export type CampaignStepType = StepType;
export type StepProgressStatus = LeadProgressStatus;

export interface CreateCampaignInput {
  name: string;
  description?: string;
  status?: CampaignStatus;
  folder_id?: string | null;
  // Compatibility with legacy UI that allowed multiple folders.
  folder_ids?: string[];
  daily_new_leads?: number;
  respect_working_hrs?: boolean;
  profile_ids?: string[];
  steps?: Array<
    Omit<CampaignStep, 'id' | 'campaign_id'> & {
      id?: string;
    }
  >;
  // Compatibility with legacy sequence payload shape.
  sequence?: CampaignStep[];
}

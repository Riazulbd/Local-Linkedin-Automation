export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface StartWorkflowRequest {
  workflowId: string;
  linkedinProfileId: string;
  leadIds: string[];
}

export interface TestNodeRequest {
  runId?: string;
  action?: 'visit' | 'connect' | 'message' | 'follow';
  nodeType?: string;
  nodeData?: Record<string, unknown>;
  linkedinUrl?: string;
  testUrl?: string;
  linkedinProfileId?: string;
  profileId?: string;
  leadId?: string;
  messageTemplate?: string;
  lead?: {
    id: string;
    profile_id: string;
    linkedin_url: string;
    first_name?: string | null;
    last_name?: string | null;
    company?: string | null;
    title?: string | null;
  };
  isTest?: boolean;
}

export interface ProxyTestRequest {
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface ProxyTestResult {
  success: boolean;
  ip?: string;
  isp?: string;
  country?: string;
  error?: string;
}

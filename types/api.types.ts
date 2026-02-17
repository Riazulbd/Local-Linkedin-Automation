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
  nodeType: string;
  nodeData: Record<string, unknown>;
  linkedinUrl: string;
  linkedinProfileId?: string;
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

export type Json =
  | string
  | number
  | boolean
  | null
  | {
      [key: string]: Json | undefined;
    }
  | Json[];

export interface Database {
  public: {
    Tables: {
      leads: {
        Row: {
          id: string;
          linkedin_url: string;
          first_name: string | null;
          last_name: string | null;
          company: string | null;
          title: string | null;
          extra_data: Json;
          status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          linkedin_url: string;
          first_name?: string | null;
          last_name?: string | null;
          company?: string | null;
          title?: string | null;
          extra_data?: Json;
          status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          linkedin_url?: string;
          first_name?: string | null;
          last_name?: string | null;
          company?: string | null;
          title?: string | null;
          extra_data?: Json;
          status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workflows: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          nodes: Json;
          edges: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          nodes?: Json;
          edges?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          nodes?: Json;
          edges?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      execution_runs: {
        Row: {
          id: string;
          workflow_id: string;
          status: 'running' | 'completed' | 'stopped' | 'failed';
          leads_total: number;
          leads_completed: number;
          leads_failed: number;
          started_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          workflow_id: string;
          status?: 'running' | 'completed' | 'stopped' | 'failed';
          leads_total?: number;
          leads_completed?: number;
          leads_failed?: number;
          started_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          workflow_id?: string;
          status?: 'running' | 'completed' | 'stopped' | 'failed';
          leads_total?: number;
          leads_completed?: number;
          leads_failed?: number;
          started_at?: string;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'execution_runs_workflow_id_fkey';
            columns: ['workflow_id'];
            isOneToOne: false;
            referencedRelation: 'workflows';
            referencedColumns: ['id'];
          },
        ];
      };
      execution_logs: {
        Row: {
          id: string;
          run_id: string;
          lead_id: string | null;
          node_id: string;
          node_type: string;
          status: 'running' | 'success' | 'error' | 'skipped';
          message: string | null;
          result_data: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          run_id: string;
          lead_id?: string | null;
          node_id: string;
          node_type: string;
          status: 'running' | 'success' | 'error' | 'skipped';
          message?: string | null;
          result_data?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          run_id?: string;
          lead_id?: string | null;
          node_id?: string;
          node_type?: string;
          status?: 'running' | 'success' | 'error' | 'skipped';
          message?: string | null;
          result_data?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'execution_logs_run_id_fkey';
            columns: ['run_id'];
            isOneToOne: false;
            referencedRelation: 'execution_runs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'execution_logs_lead_id_fkey';
            columns: ['lead_id'];
            isOneToOne: false;
            referencedRelation: 'leads';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

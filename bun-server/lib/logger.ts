import { supabase } from './supabase';

export class Logger {
  constructor(private runId?: string | null) {}

  private canPersist() {
    if (!this.runId) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(this.runId);
  }

  async log(
    category: string,
    nodeType: string,
    status: 'running' | 'success' | 'error' | 'skipped',
    message: string,
    leadId?: string
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${category}] [${status}] ${message}`);

    if (!this.canPersist()) {
      return;
    }

    try {
      await supabase.from('execution_logs').insert({
        run_id: this.runId,
        node_id: category,
        node_type: nodeType,
        status,
        message,
        lead_id: leadId ?? null,
      });
    } catch (e) {
      console.error('[Logger] Failed to insert log:', e);
    }
  }
}

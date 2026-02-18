import type { SupabaseClient } from '@supabase/supabase-js';

export type AppActionStatus = 'success' | 'error';

export interface AppActionLogInput {
  actionType: string;
  entityType: string;
  entityId?: string | null;
  status: AppActionStatus;
  requestData?: Record<string, unknown>;
  responseData?: Record<string, unknown>;
  errorMessage?: string | null;
}

export async function logAppAction(
  supabase: SupabaseClient,
  input: AppActionLogInput
): Promise<void> {
  const { error } = await supabase.from('app_action_logs').insert({
    action_type: input.actionType,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    status: input.status,
    request_data: input.requestData ?? {},
    response_data: input.responseData ?? {},
    error_message: input.errorMessage ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }
}

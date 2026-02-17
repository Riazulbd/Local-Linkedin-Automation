import type { SupabaseClient } from '@supabase/supabase-js';
import type { SyncStatus, UniboxConversation, UniboxMessage } from '@/types';

export async function getUniboxConversations(
  supabase: SupabaseClient,
  profileId?: string
): Promise<UniboxConversation[]> {
  let query = supabase
    .from('unibox_conversations')
    .select('*')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false });

  if (profileId) {
    query = query.eq('profile_id', profileId);
  }

  const { data, error } = await query.limit(300);
  if (error) throw new Error(error.message);

  return (data ?? []) as UniboxConversation[];
}

export async function getUniboxMessages(
  supabase: SupabaseClient,
  conversationId: string
): Promise<UniboxMessage[]> {
  const { data, error } = await supabase
    .from('unibox_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true })
    .limit(1000);
  if (error) throw new Error(error.message);

  return (data ?? []) as UniboxMessage[];
}

export async function getUniboxSyncStatus(
  supabase: SupabaseClient,
  profileId?: string
): Promise<SyncStatus[]> {
  let query = supabase
    .from('unibox_conversations')
    .select('profile_id,last_synced_at')
    .order('updated_at', { ascending: false })
    .limit(1000);

  if (profileId) {
    query = query.eq('profile_id', profileId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const map = new Map<string, { lastSyncedAt: string | null; conversationsSynced: number }>();
  for (const row of data ?? []) {
    const rec = row as Record<string, unknown>;
    const id = String(rec.profile_id || '');
    if (!id) continue;

    const existing = map.get(id) ?? { lastSyncedAt: null, conversationsSynced: 0 };
    existing.conversationsSynced += 1;
    const syncedAt = rec.last_synced_at == null ? null : String(rec.last_synced_at);
    if (syncedAt && (!existing.lastSyncedAt || syncedAt > existing.lastSyncedAt)) {
      existing.lastSyncedAt = syncedAt;
    }
    map.set(id, existing);
  }

  return Array.from(map.entries()).map(([id, row]) => ({
    profile_id: id,
    last_synced_at: row.lastSyncedAt,
    is_syncing: false,
    conversations_synced: row.conversationsSynced,
  }));
}

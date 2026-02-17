import type { SupabaseClient } from '@supabase/supabase-js';
import type { Message, MessageThread } from '@/types';

export async function getThreadsByProfile(
  supabase: SupabaseClient,
  profileId: string
): Promise<MessageThread[]> {
  const { data, error } = await supabase
    .from('message_threads')
    .select('*')
    .eq('profile_id', profileId)
    .order('last_message_at', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(400);

  if (error) throw new Error(error.message);
  return (data ?? []) as MessageThread[];
}

export async function getAllThreads(supabase: SupabaseClient): Promise<MessageThread[]> {
  const { data, error } = await supabase
    .from('message_threads')
    .select('*')
    .order('last_message_at', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(600);

  if (error) throw new Error(error.message);
  return (data ?? []) as MessageThread[];
}

export async function getMessagesByThread(
  supabase: SupabaseClient,
  threadId: string
): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('sent_at', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1000);

  if (error) throw new Error(error.message);
  return (data ?? []) as Message[];
}

export async function markThreadRead(
  supabase: SupabaseClient,
  threadId: string
): Promise<void> {
  const { error } = await supabase
    .from('message_threads')
    .update({ unread_count: 0, updated_at: new Date().toISOString() })
    .eq('id', threadId);

  if (error) throw new Error(error.message);
}

export async function getTotalUnread(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from('message_threads')
    .select('unread_count');

  if (error) throw new Error(error.message);
  return (data ?? []).reduce((sum, row) => sum + Number((row as any).unread_count || 0), 0);
}

// Compatibility wrappers used by existing API routes.
export async function getUniboxConversations(
  supabase: SupabaseClient,
  profileId?: string
): Promise<MessageThread[]> {
  const rows = profileId
    ? await getThreadsByProfile(supabase, profileId)
    : await getAllThreads(supabase);

  return rows.map((thread) => ({
    ...thread,
    contact_name: thread.participant_name,
    contact_linkedin_url: thread.participant_url,
  }));
}

export async function getUniboxMessages(
  supabase: SupabaseClient,
  conversationId: string
): Promise<Message[]> {
  const rows = await getMessagesByThread(supabase, conversationId);
  return rows.map((message) => ({
    ...message,
    sender_is_me: message.direction === 'sent',
    sender_name: message.direction === 'sent' ? 'You' : null,
  }));
}

export async function getUniboxSyncStatus(
  supabase: SupabaseClient,
  profileId?: string
) {
  const threads = profileId
    ? await getThreadsByProfile(supabase, profileId)
    : await getAllThreads(supabase);

  const grouped = new Map<string, { lastSynced: string | null; count: number }>();

  for (const thread of threads) {
    const current = grouped.get(thread.profile_id) || { lastSynced: null, count: 0 };
    current.count += 1;
    if (thread.updated_at && (!current.lastSynced || thread.updated_at > current.lastSynced)) {
      current.lastSynced = thread.updated_at;
    }
    grouped.set(thread.profile_id, current);
  }

  return Array.from(grouped.entries()).map(([profileIdKey, entry]) => ({
    profile_id: profileIdKey,
    last_synced_at: entry.lastSynced,
    is_syncing: false,
    conversations_synced: entry.count,
  }));
}

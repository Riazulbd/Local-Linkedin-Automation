'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Message, MessageThread, SyncStatus } from '@/types';

interface UniboxContextValue {
  threads: MessageThread[];
  selectedThread: MessageThread | null;
  selectedThreadId: string | null;
  messages: Message[];
  totalUnread: number;
  syncStatus: SyncStatus[];
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  refreshThreads: (profileId?: string) => Promise<void>;
  refreshConversations: (profileId?: string) => Promise<void>;
  selectThread: (threadId: string | null) => Promise<void>;
  selectConversation: (threadId: string | null) => Promise<void>;
  syncProfile: (profileId: string) => Promise<void>;
  syncAllProfiles: () => Promise<void>;
  markThreadRead: (threadId: string) => Promise<void>;
  sendReply: (threadId: string, message: string) => Promise<void>;
  // Backward-compat aliases used by existing UI.
  conversations: MessageThread[];
  selectedConversationId: string | null;
}

const UniboxContext = createContext<UniboxContextValue | null>(null);

function toSyncStatus(threads: MessageThread[]): SyncStatus[] {
  const byProfile = new Map<string, SyncStatus>();

  for (const thread of threads) {
    const existing = byProfile.get(thread.profile_id);
    if (existing) {
      existing.conversations_synced += 1;
      if (thread.updated_at && (!existing.last_synced_at || thread.updated_at > existing.last_synced_at)) {
        existing.last_synced_at = thread.updated_at;
      }
      continue;
    }

    byProfile.set(thread.profile_id, {
      profile_id: thread.profile_id,
      last_synced_at: thread.updated_at || null,
      is_syncing: false,
      conversations_synced: 1,
    });
  }

  return Array.from(byProfile.values());
}

export function UniboxProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);

  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus[]>([]);
  const [activeProfileFilter, setActiveProfileFilter] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshThreads = useCallback(
    async (profileId?: string) => {
      setIsLoading(true);
      setError(null);
      setActiveProfileFilter(profileId);

      try {
        let query = supabase
          .from('message_threads')
          .select('*')
          .order('last_message_at', { ascending: false })
          .order('updated_at', { ascending: false });

        if (profileId) {
          query = query.eq('profile_id', profileId);
        }

        const { data, error: queryError } = await query.limit(400);
        if (queryError) throw queryError;

        const mapped = ((data ?? []) as MessageThread[]).map((thread) => ({
          ...thread,
          contact_name: thread.participant_name,
          contact_linkedin_url: thread.participant_url,
        }));

        setThreads(mapped);
        setSyncStatus(toSyncStatus(mapped));
        setSelectedThreadId((current) => current ?? mapped[0]?.id ?? null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed loading unibox threads');
      } finally {
        setIsLoading(false);
      }
    },
    [supabase]
  );

  const refreshMessages = useCallback(
    async (threadId: string) => {
      const { data, error: queryError } = await supabase
        .from('messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('sent_at', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(1000);

      if (queryError) {
        throw new Error(queryError.message);
      }

      const mapped = ((data ?? []) as Message[]).map((message) => ({
        ...message,
        sender_is_me: message.direction === 'sent',
        sender_name: message.direction === 'sent' ? 'You' : null,
      }));

      setMessages(mapped);
    },
    [supabase]
  );

  const selectThread = useCallback(
    async (threadId: string | null) => {
      setSelectedThreadId(threadId);
      if (!threadId) {
        setMessages([]);
        return;
      }

      try {
        await refreshMessages(threadId);
      } catch (selectionError) {
        setError(selectionError instanceof Error ? selectionError.message : 'Failed loading thread messages');
      }
    },
    [refreshMessages]
  );

  const markThreadRead = useCallback(
    async (threadId: string) => {
      const { error: updateError } = await supabase
        .from('message_threads')
        .update({ unread_count: 0, updated_at: new Date().toISOString() })
        .eq('id', threadId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      await refreshThreads(activeProfileFilter);
    },
    [activeProfileFilter, refreshThreads, supabase]
  );

  const syncProfile = useCallback(
    async (profileId: string) => {
      setIsSyncing(true);
      setError(null);

      try {
        const response = await fetch('/api/unibox/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileId }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || 'Failed to sync profile inbox');
        }

        await refreshThreads(profileId);
      } catch (syncError) {
        setError(syncError instanceof Error ? syncError.message : 'Failed to sync profile inbox');
      } finally {
        setIsSyncing(false);
      }
    },
    [refreshThreads]
  );

  const syncAllProfiles = useCallback(async () => {
    setIsSyncing(true);
    setError(null);

    try {
      const response = await fetch('/api/unibox/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allProfiles: true }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to sync all profile inboxes');
      }

      await refreshThreads();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Failed to sync all profile inboxes');
    } finally {
      setIsSyncing(false);
    }
  }, [refreshThreads]);

  const sendReply = useCallback(async (threadId: string, message: string) => {
    const trimmed = message.trim();
    if (!threadId || !trimmed) {
      throw new Error('threadId and message are required');
    }

    setError(null);
    const thread = threads.find((entry) => entry.id === threadId);

    const response = await fetch('/api/unibox/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        threadId,
        profileId: thread?.profile_id,
        message: trimmed,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'Failed to send reply');
    }

    await refreshMessages(threadId);
    await refreshThreads(activeProfileFilter);
  }, [activeProfileFilter, refreshMessages, refreshThreads, threads]);

  useEffect(() => {
    refreshThreads().catch(() => undefined);
  }, [refreshThreads]);

  useEffect(() => {
    const threadsChannel = supabase
      .channel('unibox-threads-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_threads' },
        () => {
          refreshThreads(activeProfileFilter).catch(() => undefined);
        }
      )
      .subscribe();

    const messagesChannel = supabase
      .channel('unibox-messages-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => {
          if (selectedThreadId) {
            refreshMessages(selectedThreadId).catch(() => undefined);
          }
          refreshThreads(activeProfileFilter).catch(() => undefined);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(threadsChannel).catch(() => undefined);
      supabase.removeChannel(messagesChannel).catch(() => undefined);
    };
  }, [activeProfileFilter, refreshMessages, refreshThreads, selectedThreadId, supabase]);

  useEffect(() => {
    if (!selectedThreadId) return;
    refreshMessages(selectedThreadId).catch(() => undefined);
  }, [refreshMessages, selectedThreadId]);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? null,
    [threads, selectedThreadId]
  );

  const totalUnread = useMemo(
    () => threads.reduce((sum, thread) => sum + (thread.unread_count || 0), 0),
    [threads]
  );

  const value = useMemo<UniboxContextValue>(
    () => ({
      threads,
      selectedThread,
      selectedThreadId,
      messages,
      totalUnread,
      syncStatus,
      isLoading,
      isSyncing,
      error,
      refreshThreads,
      refreshConversations: refreshThreads,
      selectThread,
      selectConversation: selectThread,
      syncProfile,
      syncAllProfiles,
      markThreadRead,
      sendReply,
      conversations: threads,
      selectedConversationId: selectedThreadId,
    }),
    [
      threads,
      selectedThread,
      selectedThreadId,
      messages,
      totalUnread,
      syncStatus,
      isLoading,
      isSyncing,
      error,
      refreshThreads,
      selectThread,
      syncProfile,
      syncAllProfiles,
      markThreadRead,
      sendReply,
    ]
  );

  return <UniboxContext.Provider value={value}>{children}</UniboxContext.Provider>;
}

export function useUniboxContext() {
  const ctx = useContext(UniboxContext);
  if (!ctx) {
    throw new Error('useUniboxContext must be used within UniboxProvider');
  }
  return ctx;
}

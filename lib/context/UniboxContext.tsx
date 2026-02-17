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
import type { SyncStatus, UniboxConversation, UniboxMessage } from '@/types';

interface UniboxContextValue {
  conversations: UniboxConversation[];
  selectedConversationId: string | null;
  messages: UniboxMessage[];
  syncStatus: SyncStatus[];
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  refreshConversations: (profileId?: string) => Promise<void>;
  selectConversation: (conversationId: string | null) => Promise<void>;
  syncProfile: (profileId: string) => Promise<void>;
  syncAllProfiles: () => Promise<void>;
}

const UniboxContext = createContext<UniboxContextValue | null>(null);

export function UniboxProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<UniboxConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UniboxMessage[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshConversations = useCallback(async (profileId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const qs = profileId ? `?profileId=${encodeURIComponent(profileId)}` : '';
      const [convoRes, statusRes] = await Promise.all([
        fetch(`/api/unibox/conversations${qs}`, { cache: 'no-store' }),
        fetch(`/api/unibox/conversations/status${qs}`, { cache: 'no-store' }),
      ]);

      const convoPayload = await convoRes.json();
      const statusPayload = await statusRes.json();

      if (!convoRes.ok) throw new Error(convoPayload.error || 'Failed loading conversations');
      if (!statusRes.ok) throw new Error(statusPayload.error || 'Failed loading sync status');

      const nextConversations = (convoPayload.conversations ?? []) as UniboxConversation[];
      setConversations(nextConversations);
      setSyncStatus((statusPayload.status ?? []) as SyncStatus[]);

      setSelectedConversationId((current) => current ?? nextConversations[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed loading unibox data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectConversation = useCallback(async (conversationId: string | null) => {
    setSelectedConversationId(conversationId);
    if (!conversationId) {
      setMessages([]);
      return;
    }

    const response = await fetch(`/api/unibox/conversations/${conversationId}/messages`, { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Failed to load conversation messages');
    setMessages((payload.messages ?? []) as UniboxMessage[]);
  }, []);

  const syncProfile = useCallback(async (profileId: string) => {
    setIsSyncing(true);
    setError(null);
    try {
      const response = await fetch('/api/unibox/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Failed to sync profile inbox');
      await refreshConversations(profileId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync profile inbox');
    } finally {
      setIsSyncing(false);
    }
  }, [refreshConversations]);

  const syncAllProfiles = useCallback(async () => {
    setIsSyncing(true);
    setError(null);
    try {
      const response = await fetch('/api/unibox/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allProfiles: true }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Failed to sync all profiles');
      await refreshConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync all profiles');
    } finally {
      setIsSyncing(false);
    }
  }, [refreshConversations]);

  useEffect(() => {
    refreshConversations().catch(() => undefined);
  }, [refreshConversations]);

  useEffect(() => {
    if (!selectedConversationId) return;
    selectConversation(selectedConversationId).catch(() => undefined);
  }, [selectedConversationId, selectConversation]);

  const value = useMemo<UniboxContextValue>(
    () => ({
      conversations,
      selectedConversationId,
      messages,
      syncStatus,
      isLoading,
      isSyncing,
      error,
      refreshConversations,
      selectConversation,
      syncProfile,
      syncAllProfiles,
    }),
    [
      conversations,
      selectedConversationId,
      messages,
      syncStatus,
      isLoading,
      isSyncing,
      error,
      refreshConversations,
      selectConversation,
      syncProfile,
      syncAllProfiles,
    ]
  );

  return <UniboxContext.Provider value={value}>{children}</UniboxContext.Provider>;
}

export function useUniboxContext() {
  const ctx = useContext(UniboxContext);
  if (!ctx) throw new Error('useUniboxContext must be used within UniboxProvider');
  return ctx;
}

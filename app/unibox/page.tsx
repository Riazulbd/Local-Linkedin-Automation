'use client';

import { useMemo, useState } from 'react';
import { useUniboxContext } from '@/lib/context/UniboxContext';
import { ConversationList } from '@/components/unibox/ConversationList';
import { ConversationThread } from '@/components/unibox/ConversationThread';
import { MessageComposer } from '@/components/unibox/MessageComposer';
import { UniboxFilters } from '@/components/unibox/UniboxFilters';
import { UniboxSyncPanel } from '@/components/unibox/UniboxSyncPanel';

export default function UniboxPage() {
  const {
    conversations,
    selectedConversationId,
    messages,
    syncStatus,
    isLoading,
    isSyncing,
    error,
    selectConversation,
    syncProfile,
    syncAllProfiles,
  } = useUniboxContext();

  const [search, setSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const filtered = useMemo(() => {
    return conversations.filter((conversation) => {
      const matchesSearch =
        !search ||
        (conversation.contact_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (conversation.last_message_text || '').toLowerCase().includes(search.toLowerCase());
      const matchesUnread = !unreadOnly || conversation.unread_count > 0;
      return matchesSearch && matchesUnread;
    });
  }, [conversations, search, unreadOnly]);

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Unibox</h1>
        <p className="text-sm text-white/60">Unified inbox synced from all LinkedIn profiles.</p>
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}

      <UniboxSyncPanel
        status={syncStatus}
        syncing={isSyncing}
        onSyncAll={syncAllProfiles}
        onSyncProfile={syncProfile}
      />

      <UniboxFilters
        search={search}
        unreadOnly={unreadOnly}
        onSearchChange={setSearch}
        onUnreadOnlyChange={setUnreadOnly}
      />

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <section className="space-y-2">
          {isLoading && <p className="text-xs text-white/60">Loading conversations...</p>}
          <ConversationList
            conversations={filtered}
            selectedConversationId={selectedConversationId}
            onSelect={(id) => selectConversation(id).catch(() => undefined)}
          />
        </section>

        <section className="space-y-3">
          <ConversationThread messages={messages} />
          <MessageComposer />
        </section>
      </div>
    </main>
  );
}

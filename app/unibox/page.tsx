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
    selectedThread,
    messages,
    totalUnread,
    syncStatus,
    isLoading,
    isSyncing,
    error,
    refreshThreads,
    selectConversation,
    syncProfile,
    syncAllProfiles,
    sendReply,
  } = useUniboxContext();

  const [search, setSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [profileFilter, setProfileFilter] = useState('all');

  const profileOptions = useMemo(() => {
    return Array.from(new Set(conversations.map((conversation) => conversation.profile_id)));
  }, [conversations]);

  const filtered = useMemo(() => {
    return conversations.filter((conversation) => {
      const matchesProfile = profileFilter === 'all' || conversation.profile_id === profileFilter;
      const matchesSearch =
        !search ||
        (conversation.contact_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (conversation.last_message_text || '').toLowerCase().includes(search.toLowerCase());
      const matchesUnread = !unreadOnly || conversation.unread_count > 0;
      return matchesProfile && matchesSearch && matchesUnread;
    });
  }, [conversations, profileFilter, search, unreadOnly]);

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Unibox</h1>
          <p className="text-sm text-slate-500">Unified inbox synced from all LinkedIn profiles.</p>
        </div>
        <div className="rounded-full border border-amber-500/40 bg-amber-500/20 px-3 py-1 text-xs text-amber-100">
          Unread: {totalUnread}
        </div>
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <label className="text-xs text-slate-600">
          Profile filter
          <select
            value={profileFilter}
            onChange={(event) => {
              const value = event.target.value;
              setProfileFilter(value);
              refreshThreads(value === 'all' ? undefined : value).catch(() => undefined);
            }}
            className="mt-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-900"
          >
            <option value="all">All profiles</option>
            {profileOptions.map((profileId) => (
              <option key={profileId} value={profileId}>
                {profileId}
              </option>
            ))}
          </select>
        </label>
      </div>

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
          {isLoading && <p className="text-xs text-slate-500">Loading conversations...</p>}
          <ConversationList
            conversations={filtered}
            selectedConversationId={selectedConversationId}
            onSelect={(id) => selectConversation(id).catch(() => undefined)}
          />
        </section>

        <section className="space-y-3">
          <ConversationThread messages={messages} />
          <MessageComposer
            disabled={!selectedThread}
            onSend={
              selectedThread
                ? async (text) => {
                    await sendReply(selectedThread.id, text);
                  }
                : undefined
            }
          />
        </section>
      </div>
    </main>
  );
}

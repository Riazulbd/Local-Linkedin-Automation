'use client';

import type { UniboxConversation } from '@/types';

interface ConversationListProps {
  conversations: UniboxConversation[];
  selectedConversationId?: string | null;
  onSelect: (conversationId: string) => void;
}

export function ConversationList({
  conversations,
  selectedConversationId = null,
  onSelect,
}: ConversationListProps) {
  if (!conversations.length) {
    return (
      <div className="rounded-lg border border-dashed border-white/20 bg-white/5 p-4 text-sm text-white/60">
        No conversations synced yet.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {conversations.map((conversation) => (
        <button
          key={conversation.id}
          type="button"
          onClick={() => onSelect(conversation.id)}
          className={`w-full rounded-lg border px-3 py-2 text-left transition ${
            selectedConversationId === conversation.id
              ? 'border-cyan-400/40 bg-cyan-500/10'
              : 'border-white/10 bg-white/5 hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium text-white">{conversation.contact_name || 'Unknown contact'}</p>
            {conversation.unread_count > 0 && (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-100">
                {conversation.unread_count}
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-xs text-white/60">
            {conversation.last_message_text || 'No preview available'}
          </p>
        </button>
      ))}
    </div>
  );
}

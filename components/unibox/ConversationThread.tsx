'use client';

import type { UniboxMessage } from '@/types';

interface ConversationThreadProps {
  messages: UniboxMessage[];
}

export function ConversationThread({ messages }: ConversationThreadProps) {
  if (!messages.length) {
    return (
      <div className="rounded-lg border border-dashed border-white/20 bg-white/5 p-4 text-sm text-white/60">
        Select a conversation to view messages.
      </div>
    );
  }

  return (
    <div className="max-h-[560px] space-y-2 overflow-auto rounded-lg border border-white/10 bg-black/20 p-3">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`max-w-[85%] rounded-xl border px-3 py-2 text-sm ${
            message.sender_is_me
              ? 'ml-auto border-cyan-400/30 bg-cyan-500/10 text-cyan-100'
              : 'mr-auto border-white/15 bg-white/5 text-white/85'
          }`}
        >
          <p className="text-[11px] text-white/50">{message.sender_name || (message.sender_is_me ? 'You' : 'Contact')}</p>
          <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
          <p className="mt-1 text-[10px] text-white/40">
            {message.sent_at ? new Date(message.sent_at).toLocaleString() : 'Unknown time'}
          </p>
        </div>
      ))}
    </div>
  );
}

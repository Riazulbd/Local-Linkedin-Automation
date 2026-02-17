'use client';

import type { UniboxMessage } from '@/types';

interface ConversationThreadProps {
  messages: UniboxMessage[];
}

export function ConversationThread({ messages }: ConversationThreadProps) {
  if (!messages.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
        Select a conversation to view messages.
      </div>
    );
  }

  return (
    <div className="max-h-[560px] space-y-2 overflow-auto rounded-lg border border-slate-200 bg-slate-100 p-3">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`max-w-[85%] rounded-xl border px-3 py-2 text-sm ${
            message.sender_is_me
              ? 'ml-auto border-cyan-400/30 bg-cyan-500/10 text-cyan-100'
              : 'mr-auto border-slate-200 bg-slate-50 text-slate-800'
          }`}
        >
          <p className="text-[11px] text-slate-400">{message.sender_name || (message.sender_is_me ? 'You' : 'Contact')}</p>
          <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
          <p className="mt-1 text-[10px] text-slate-400">
            {message.sent_at ? new Date(message.sent_at).toLocaleString() : 'Unknown time'}
          </p>
        </div>
      ))}
    </div>
  );
}

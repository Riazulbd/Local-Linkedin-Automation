'use client';

import { useState } from 'react';

interface MessageComposerProps {
  disabled?: boolean;
  onSend?: (text: string) => Promise<void>;
}

export function MessageComposer({ disabled = false, onSend }: MessageComposerProps) {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || !onSend) return;

    setIsSending(true);
    try {
      await onSend(trimmed);
      setText('');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <label className="block text-xs text-white/70">
        Reply draft
        <textarea
          rows={3}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Type a message..."
          disabled={disabled || isSending}
          className="mt-1 w-full rounded-md border border-white/15 bg-white/5 px-2.5 py-2 text-sm text-white placeholder:text-white/35 disabled:opacity-60"
        />
      </label>
      <button
        type="button"
        disabled={disabled || isSending || !text.trim() || !onSend}
        onClick={handleSend}
        className="mt-2 rounded-md border border-cyan-400/40 px-2.5 py-1 text-xs text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-50"
      >
        {isSending ? 'Sending...' : 'Send (local)'}
      </button>
    </div>
  );
}

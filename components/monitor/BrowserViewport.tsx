'use client';

import { useState } from 'react';
import { Monitor, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BrowserViewport() {
  const [showBrowser, setShowBrowser] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border border-border bg-black shadow-2xl transition-all duration-300',
        isMaximized ? 'fixed inset-4 z-50' : 'h-full'
      )}
    >
      <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
          </div>
          <div className="ml-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
            <Monitor className="h-3.5 w-3.5" />
            Live Virtual Desktop
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBrowser(!showBrowser)}
            className="rounded-md p-1.5 text-white/60 hover:bg-white/10 transition-colors"
          >
            {showBrowser ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="rounded-md p-1.5 text-white/60 hover:bg-white/10 transition-colors"
          >
            {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="relative flex-1 bg-[#1a1a1a]">
        {showBrowser ? (
          <iframe
            src={`http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:6080/vnc.html?autoconnect=true&resize=scale`}
            className="h-full w-full border-none"
            title="Browser Feed"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Monitor className="mx-auto h-12 w-12 text-white/10 mb-4" />
              <p className="text-sm text-white/40 font-medium">Feed Hidden</p>
              <button
                onClick={() => setShowBrowser(true)}
                className="mt-4 text-xs font-semibold text-accent hover:underline"
              >
                Reconnect Visual Stream
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

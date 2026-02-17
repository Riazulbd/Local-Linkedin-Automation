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
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
          </div>
          <div className="ml-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <Monitor className="h-3.5 w-3.5" />
            Live Virtual Desktop
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBrowser(!showBrowser)}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 transition-colors"
          >
            {showBrowser ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 transition-colors"
          >
            {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="relative flex-1 bg-[#1a1a1a]">
        {showBrowser ? (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <div>
              <Monitor className="mx-auto mb-4 h-12 w-12 text-slate-300" />
              <p className="text-sm font-medium text-slate-300">VNC stream removed from this build.</p>
              <p className="mt-2 text-xs text-slate-400">
                Browser sessions still run via Playwright/AdsPower, but remote VNC preview is disabled.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Monitor className="mx-auto h-12 w-12 text-slate-300 mb-4" />
              <p className="text-sm text-slate-400 font-medium">Feed Hidden</p>
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

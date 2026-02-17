'use client';

import { ReactNode } from 'react';
import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';

interface DashboardLayoutProps {
  activeTab: 'canvas' | 'leads' | 'logs' | 'test';
  onTabChange: (tab: 'canvas' | 'leads' | 'logs' | 'test') => void;
  children: ReactNode;
}

export function DashboardLayout({ activeTab, onTabChange, children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#0a0a0f] text-text-primary selection:bg-accent/30">
      <TopBar activeTab={activeTab} onTabChange={onTabChange} />
      <main className="relative flex-1 overflow-hidden bg-dot-white/[0.05]">
        {/* Decorative background blurs */}
        <div className="fixed -top-[10%] -left-[10%] h-[40%] w-[40%] rounded-full bg-accent/10 blur-[120px]" />
        <div className="fixed -bottom-[10%] -right-[10%] h-[40%] w-[40%] rounded-full bg-success/5 blur-[120px]" />

        <div className="relative z-10 h-full w-full">
          {children}
        </div>
      </main>
      <StatusBar />
    </div>
  );
}

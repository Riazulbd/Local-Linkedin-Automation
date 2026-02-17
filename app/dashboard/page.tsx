'use client';

import { useState } from 'react';
import type { ComponentType } from 'react';
import { Cable, Bug, FileSpreadsheet, LayoutGrid } from 'lucide-react';
import { WorkflowCanvas } from '@/components/canvas/WorkflowCanvas';
import { LeadsTable } from '@/components/leads/LeadsTable';
import { ExecutionLog } from '@/components/logs/ExecutionLog';
import { TestRunner } from '@/components/test/TestRunner';
import { StatusBar } from '@/components/dashboard/StatusBar';
import { Tabs } from '@/components/untitled/application/tabs/tabs';

type Tab = 'canvas' | 'leads' | 'logs' | 'test';

const TABS: Array<{ id: Tab; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: 'canvas', label: 'Canvas', icon: LayoutGrid },
  { id: 'leads', label: 'Leads', icon: FileSpreadsheet },
  { id: 'logs', label: 'Execution', icon: Cable },
  { id: 'test', label: 'Node Lab', icon: Bug },
];

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('canvas');

  return (
    <section className="flex h-full min-h-0 flex-col p-4 md:p-5">
      <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Today's Capacity</span>
          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-700">Connections 22 / 25</span>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">Messages 37 / 50</span>
          <span className="rounded-full bg-violet-100 px-2.5 py-1 text-violet-700">Weekly 97 / 100</span>
        </div>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <article className="rounded-2xl bg-slate-900 p-5 text-white">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-300">Outreach</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight">49</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Connected</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">22</p>
          <p className="mt-2 text-sm text-emerald-600">45% rate</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Engaged</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">9</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Meetings</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">0</p>
        </article>
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Pipeline</p>
          <div className="mt-4 space-y-3">
            {[
              { label: 'New', value: 13, color: 'bg-slate-900' },
              { label: 'Sent', value: 14, color: 'bg-blue-500' },
              { label: 'Connected', value: 11, color: 'bg-emerald-500' },
              { label: 'Engaged', value: 9, color: 'bg-amber-500' },
              { label: 'Followup', value: 3, color: 'bg-violet-500' },
            ].map((row) => (
              <div key={row.label} className="grid grid-cols-[84px_1fr_28px] items-center gap-3 text-sm">
                <span className="text-slate-600">{row.label}</span>
                <div className="h-3 rounded-full bg-slate-100">
                  <div className={`h-3 rounded-full ${row.color}`} style={{ width: `${row.value * 7}%` }} />
                </div>
                <span className="text-right text-slate-500">{row.value}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Weekly Activity</p>
          <svg viewBox="0 0 420 180" className="mt-4 h-[180px] w-full">
            <defs>
              <linearGradient id="blueFade" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="greenFade" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity="0.24" />
                <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polyline fill="url(#blueFade)" stroke="none" points="0,150 0,100 70,84 140,120 210,70 280,78 350,130 420,146 420,150" />
            <polyline fill="url(#greenFade)" stroke="none" points="0,150 0,118 70,100 140,66 210,78 280,52 350,138 420,150 420,150" />
            <polyline fill="none" stroke="#3b82f6" strokeWidth="3" points="0,100 70,84 140,120 210,70 280,78 350,130 420,146" />
            <polyline fill="none" stroke="#22c55e" strokeWidth="3" points="0,118 70,100 140,66 210,78 280,52 350,138 420,150" />
          </svg>
        </article>
      </div>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Workspace</h2>
          <p className="text-sm text-slate-500">Design your flow, execute runs, and validate nodes in one workspace.</p>
        </div>

        <Tabs selectedKey={activeTab} onSelectionChange={(key) => setActiveTab(String(key) as Tab)} className="w-auto">
          <Tabs.List
            size="sm"
            type="button-brand"
            items={TABS.map((tab) => ({
              id: tab.id,
              children: (
                <span className="inline-flex items-center gap-1.5">
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                </span>
              ),
            }))}
          />
        </Tabs>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {activeTab === 'canvas' && <WorkflowCanvas />}
        {activeTab === 'leads' && <LeadsTable />}
        {activeTab === 'logs' && <ExecutionLog />}
        {activeTab === 'test' && <TestRunner />}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <StatusBar />
      </div>
    </section>
  );
}

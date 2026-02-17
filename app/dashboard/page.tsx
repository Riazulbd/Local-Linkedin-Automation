'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { WorkflowCanvas } from '@/components/canvas/WorkflowCanvas';
import { LeadsTable } from '@/components/leads/LeadsTable';
import { ExecutionLog } from '@/components/logs/ExecutionLog';
import { TestRunner } from '@/components/test/TestRunner';

type Tab = 'canvas' | 'leads' | 'logs' | 'test';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('canvas');

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'canvas' && <WorkflowCanvas />}
      {activeTab === 'leads' && <LeadsTable />}
      {activeTab === 'logs' && <ExecutionLog />}
      {activeTab === 'test' && <TestRunner />}
    </DashboardLayout>
  );
}

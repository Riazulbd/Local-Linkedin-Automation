'use client';

import { useEffect, useState } from 'react';
import type { LeadFolder } from '@/types';
import { FolderForm } from '@/components/leads-folders/FolderForm';
import { FolderList } from '@/components/leads-folders/FolderList';
import { LeadFolderAssignDialog } from '@/components/leads-folders/LeadFolderAssignDialog';
import { useLeadsStore } from '@/store/leadsStore';

export default function LeadFoldersPage() {
  const leads = useLeadsStore((state) => state.leads);
  const refreshLeads = useLeadsStore((state) => state.refreshLeads);

  const [folders, setFolders] = useState<LeadFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId) ?? null;

  async function loadFolders() {
    const response = await fetch('/api/lead-folders', { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Failed to load folders');
    setFolders(payload.folders ?? []);
    setSelectedFolderId((current) => current ?? payload.folders?.[0]?.id ?? null);
  }

  useEffect(() => {
    refreshLeads().catch(() => undefined);
    loadFolders().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load folders'));
  }, [refreshLeads]);

  async function createFolder(input: { name: string; description?: string; color?: string }) {
    const response = await fetch('/api/lead-folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Failed to create folder');
    await loadFolders();
  }

  async function deleteFolder(folderId: string) {
    const response = await fetch(`/api/lead-folders/${folderId}`, { method: 'DELETE' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Failed to delete folder');
    await loadFolders();
  }

  async function assignLeads(leadIds: string[]) {
    if (!selectedFolder) throw new Error('No folder selected');
    const response = await fetch(`/api/lead-folders/${selectedFolder.id}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadIds, action: 'assign' }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Failed to assign leads');
    await Promise.all([refreshLeads(), loadFolders()]);
  }

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Lead Folders</h1>
        <p className="text-sm text-slate-500">Organize leads into reusable campaign sources.</p>
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}

      <FolderForm onSubmit={createFolder} />

      <div className="grid gap-4 lg:grid-cols-2">
        <FolderList
          folders={folders}
          selectedFolderId={selectedFolderId}
          onSelect={setSelectedFolderId}
          onDelete={(id) => deleteFolder(id).catch((err) => setError(err instanceof Error ? err.message : 'Failed to delete folder'))}
        />
        <LeadFolderAssignDialog
          folder={selectedFolder}
          leads={leads}
          onAssign={assignLeads}
        />
      </div>
    </main>
  );
}

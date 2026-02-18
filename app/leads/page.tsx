'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LeadStatusBadge } from '@/components/leads/LeadStatusBadge';
import type { Lead, LeadFolder } from '@/types';

interface CreateFolderInput {
  name: string;
  color: string;
}

export default function LeadsPage() {
  const [folders, setFolders] = useState<LeadFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#0077b5');
  const [error, setError] = useState<string | null>(null);

  async function loadFolders() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/lead-folders', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to load lead folders');
      const nextFolders = (payload.folders ?? []) as LeadFolder[];
      setFolders(nextFolders);
      setSelectedFolderId((current) => {
        if (current && nextFolders.some((folder) => folder.id === current)) return current;
        return nextFolders[0]?.id ?? null;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load lead folders');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadFolderLeads(folderId: string) {
    setIsLoadingLeads(true);
    setError(null);
    try {
      const response = await fetch(`/api/lead-folders/${folderId}/leads`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to load folder leads');
      setLeads((payload.leads ?? []) as Lead[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load folder leads');
      setLeads([]);
    } finally {
      setIsLoadingLeads(false);
    }
  }

  async function loadAllLeads() {
    setIsLoadingLeads(true);
    setError(null);
    try {
      const response = await fetch('/api/leads?limit=100', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to load leads');
      setLeads((payload.leads ?? payload.data ?? []) as Lead[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load leads');
      setLeads([]);
    } finally {
      setIsLoadingLeads(false);
    }
  }

  useEffect(() => {
    loadFolders().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!selectedFolderId) {
      if (!folders.length) {
        loadAllLeads().catch(() => undefined);
      } else {
        setLeads([]);
      }
      return;
    }
    loadFolderLeads(selectedFolderId).catch(() => undefined);
  }, [selectedFolderId, folders.length]);

  async function createFolder(input: CreateFolderInput) {
    setIsCreating(true);
    setError(null);
    try {
      const response = await fetch('/api/lead-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to create folder');

      setName('');
      await loadFolders();
      if (payload.folder?.id) {
        setSelectedFolderId(payload.folder.id);
      }
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create folder');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Lead Folders</h1>
          <p className="text-sm text-slate-500">Organize your leads into folders and launch campaigns from them.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/leads/folders"
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 transition hover:bg-slate-100"
          >
            Manage Folders
          </Link>
          <Link
            href="/leads/add-single"
            className="rounded-md border border-cyan-400/40 px-3 py-2 text-xs text-cyan-200 transition hover:bg-cyan-500/20"
          >
            + Add Single Lead
          </Link>
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          createFolder({ name: name.trim(), color }).catch(() => undefined);
        }}
        className="rounded-xl border border-slate-200 bg-slate-50 p-4"
      >
        <h2 className="text-sm font-semibold text-slate-900">Create Folder</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_160px_auto]">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Folder name"
            className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-900"
          />
          <input
            value={color}
            onChange={(event) => setColor(event.target.value)}
            type="color"
            className="h-10 rounded-md border border-slate-200 bg-slate-50 px-2"
          />
          <button
            type="submit"
            disabled={isCreating || !name.trim()}
            className="rounded-md border border-cyan-400/40 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-60"
          >
            {isCreating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>

      {error && <p className="text-sm text-rose-300">{error}</p>}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading folders...</p>
      ) : (
        <section className="space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {folders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => setSelectedFolderId(folder.id)}
                className={`rounded-md border px-3 py-1.5 text-xs transition ${
                  selectedFolderId === folder.id
                    ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-100'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {folder.name} ({folder.lead_count})
              </button>
            ))}
          </div>

          {!folders.length && (
            <div className="space-y-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6">
              <p className="text-sm text-slate-600">No folders yet. Showing recent leads.</p>
              <p className="text-xs text-slate-500">Create a folder above to organize and attach leads to campaigns.</p>
            </div>
          )}

          {Boolean(folders.length) && !selectedFolderId && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
              Select a folder to view its leads.
            </div>
          )}

          {(selectedFolderId || !folders.length) && (
            <div className="space-y-2">
              {selectedFolderId && (
                <div className="flex items-center justify-end">
                  <Link
                    href={`/leads/${selectedFolderId}`}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100"
                  >
                    Open Folder Detail
                  </Link>
                </div>
              )}
              <div className="overflow-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Company</th>
                      <th className="px-3 py-2">Title</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Profile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingLeads && (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">
                          Loading leads...
                        </td>
                      </tr>
                    )}
                    {!isLoadingLeads &&
                      leads.map((lead) => (
                        <tr key={lead.id} className="border-t border-slate-200">
                          <td className="px-3 py-2">
                            {`${lead.first_name || ''} ${lead.last_name || ''}`.trim() || '-'}
                          </td>
                          <td className="px-3 py-2">{lead.company || '-'}</td>
                          <td className="px-3 py-2">{lead.title || '-'}</td>
                          <td className="px-3 py-2">
                            <LeadStatusBadge status={lead.status} />
                          </td>
                          <td className="px-3 py-2">
                            <a
                              href={lead.linkedin_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-cyan-300 hover:underline"
                            >
                              View
                            </a>
                          </td>
                        </tr>
                      ))}

                    {!isLoadingLeads && !leads.length && (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">
                          No leads in this folder.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

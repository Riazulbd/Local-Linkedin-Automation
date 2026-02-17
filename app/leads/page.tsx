'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { LeadFolder } from '@/types';

interface CreateFolderInput {
  name: string;
  color: string;
}

export default function LeadsPage() {
  const [folders, setFolders] = useState<LeadFolder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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
      setFolders(payload.folders ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load lead folders');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadFolders().catch(() => undefined);
  }, []);

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
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {folders.map((folder) => (
            <Link
              key={folder.id}
              href={`/leads/${folder.id}`}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">{folder.name}</h3>
                <span
                  className="h-3 w-3 rounded-full border border-slate-300"
                  style={{ backgroundColor: folder.color || '#0077b5' }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">{folder.description || 'No description'}</p>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                <span>{folder.lead_count} leads</span>
                <span>{new Date(folder.updated_at).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}

          {!folders.length && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
              No folders yet. Create your first folder above.
            </div>
          )}
        </section>
      )}
    </main>
  );
}

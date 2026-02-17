'use client';

import { useState } from 'react';
import type { CreateFolderInput, LeadFolder } from '@/types';

interface FolderFormProps {
  initial?: Partial<LeadFolder>;
  onSubmit: (input: CreateFolderInput) => Promise<void>;
}

export function FolderForm({ initial, onSubmit }: FolderFormProps) {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [color, setColor] = useState(initial?.color || '#0ea5e9');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Folder name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        color,
      });
      if (!initial?.id) {
        setName('');
        setDescription('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save folder');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <h3 className="text-sm font-semibold text-slate-900">{initial?.id ? 'Edit Folder' : 'New Folder'}</h3>
      <div className="mt-2 grid gap-2 md:grid-cols-3">
        <label className="text-xs text-slate-600">
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-sm text-slate-900"
          />
        </label>
        <label className="text-xs text-slate-600">
          Color
          <input
            value={color}
            onChange={(event) => setColor(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-sm text-slate-900"
          />
        </label>
        <label className="text-xs text-slate-600">
          Description
          <input
            value={description || ''}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-sm text-slate-900"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-3 rounded-md border border-cyan-400/40 px-2.5 py-1 text-xs text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-60"
      >
        {isSubmitting ? 'Saving...' : initial?.id ? 'Update Folder' : 'Create Folder'}
      </button>

      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </form>
  );
}

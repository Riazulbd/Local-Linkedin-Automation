'use client';

import type { LeadFolder } from '@/types';
import { FolderBadge } from './FolderBadge';

interface FolderListProps {
  folders: LeadFolder[];
  selectedFolderId?: string | null;
  onSelect?: (folderId: string) => void;
  onDelete?: (folderId: string) => void;
}

export function FolderList({ folders, selectedFolderId = null, onSelect, onDelete }: FolderListProps) {
  if (!folders.length) {
    return (
      <div className="rounded-lg border border-dashed border-white/20 bg-white/5 p-4 text-sm text-white/60">
        No folders created.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {folders.map((folder) => (
        <div
          key={folder.id}
          className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
            selectedFolderId === folder.id
              ? 'border-cyan-400/40 bg-cyan-500/10'
              : 'border-white/10 bg-white/5'
          }`}
        >
          <button
            type="button"
            onClick={() => onSelect?.(folder.id)}
            className="text-left"
          >
            <FolderBadge folder={folder} />
            <p className="mt-1 text-xs text-white/50">{folder.description || 'No description'}</p>
          </button>

          <button
            type="button"
            onClick={() => onDelete?.(folder.id)}
            className="rounded-md border border-rose-500/30 px-2 py-0.5 text-xs text-rose-200 hover:bg-rose-500/20"
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}

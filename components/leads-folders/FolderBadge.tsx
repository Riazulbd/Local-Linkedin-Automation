'use client';

import type { LeadFolder } from '@/types';

export function FolderBadge({ folder }: { folder: LeadFolder }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px]"
      style={{
        borderColor: `${folder.color}66`,
        backgroundColor: `${folder.color}22`,
        color: folder.color,
      }}
      title={folder.description || folder.name}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: folder.color }}
      />
      {folder.name} ({folder.lead_count})
    </span>
  );
}

'use client';

interface UniboxFiltersProps {
  search: string;
  unreadOnly: boolean;
  onSearchChange: (value: string) => void;
  onUnreadOnlyChange: (value: boolean) => void;
}

export function UniboxFilters({
  search,
  unreadOnly,
  onSearchChange,
  onUnreadOnlyChange,
}: UniboxFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
      <input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search conversations..."
        className="min-w-56 flex-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400"
      />
      <label className="inline-flex items-center gap-1 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={unreadOnly}
          onChange={(event) => onUnreadOnlyChange(event.target.checked)}
        />
        Unread only
      </label>
    </div>
  );
}

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
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-2">
      <input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search conversations..."
        className="min-w-56 flex-1 rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-sm text-white placeholder:text-white/30"
      />
      <label className="inline-flex items-center gap-1 text-xs text-white/70">
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

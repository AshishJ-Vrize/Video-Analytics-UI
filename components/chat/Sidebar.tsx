'use client';

import { useMemo } from 'react';
import type { MeetingItem } from '@/lib/chat-api';

interface SidebarProps {
  meetings: MeetingItem[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onClearAll: () => void;
  loading: boolean;
}

// Group by relative time: Today / Yesterday / This Week / Earlier
function bucketOf(iso: string): 'today' | 'yesterday' | 'week' | 'earlier' {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday); startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfWeek.getDate() - 7);

  if (d >= startOfToday) return 'today';
  if (d >= startOfYesterday) return 'yesterday';
  if (d >= startOfWeek) return 'week';
  return 'earlier';
}

const BUCKET_LABELS: Record<ReturnType<typeof bucketOf>, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'This Week',
  earlier: 'Earlier',
};

export default function Sidebar({ meetings, selectedIds, onToggle, onClearAll, loading }: SidebarProps) {
  const grouped = useMemo(() => {
    const buckets: Record<string, MeetingItem[]> = { today: [], yesterday: [], week: [], earlier: [] };
    for (const m of meetings) buckets[bucketOf(m.meeting_date)].push(m);
    return buckets;
  }, [meetings]);

  const orderedKeys = (['today', 'yesterday', 'week', 'earlier'] as const).filter((k) => grouped[k].length > 0);

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Meetings</h2>
        {selectedIds.size > 0 && (
          <button
            onClick={onClearAll}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            Clear ({selectedIds.size})
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading && <p className="px-2 py-3 text-xs text-muted">Loading meetings…</p>}
        {!loading && meetings.length === 0 && (
          <p className="px-2 py-3 text-xs text-muted">
            No meetings yet. <a href="/ingest" className="underline">Ingest one</a>.
          </p>
        )}

        {orderedKeys.map((key) => (
          <div key={key} className="mb-3">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
              {BUCKET_LABELS[key]}
            </p>
            {grouped[key].map((m) => (
              <MeetingRow
                key={m.id}
                meeting={m}
                selected={selectedIds.has(m.id)}
                onToggle={() => onToggle(m.id)}
              />
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}

function MeetingRow({
  meeting,
  selected,
  onToggle,
}: {
  meeting: MeetingItem;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full rounded-md px-2 py-2 text-left transition-colors ${
        selected ? 'bg-accent/10 text-foreground' : 'text-muted hover:bg-bubble-assistant hover:text-foreground'
      }`}
    >
      <p className="truncate text-xs font-medium">{meeting.meeting_subject}</p>
      <p className="text-[10px] text-muted">
        {fmtShort(meeting.meeting_date)} · {meeting.your_role}
      </p>
    </button>
  );
}

function fmtShort(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

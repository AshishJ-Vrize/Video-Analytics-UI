'use client';

import type { SourceOut } from '@/lib/chat-api';

export default function SourcesCard({ sources }: { sources: SourceOut[] }) {
  if (sources.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {sources.map((s, i) => (
        <div
          key={`${s.meeting_id}-${i}`}
          className="rounded-md border border-border bg-surface px-3 py-2 text-xs"
        >
          <p className="font-medium text-foreground">{s.meeting_title}</p>
          <p className="text-muted">
            {s.meeting_date ? fmtDate(s.meeting_date) : '—'}
            {s.speakers.length > 0 ? ` · ${s.speakers.join(', ')}` : ''}
          </p>
          {s.timespans.length > 0 && (
            <p className="text-muted text-[10px] mt-0.5">
              {s.timespans.map((t) => fmtTimespan(t.start_ms, t.end_ms)).join(', ')}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTimespan(startMs: number, endMs: number) {
  return `${msToClock(startMs)}–${msToClock(endMs)}`;
}

function msToClock(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

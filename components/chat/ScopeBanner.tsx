'use client';

import type { ScopeChangeOut } from '@/lib/chat-api';

interface ScopeBannerProps {
  outOfWindow?: boolean;
  withinDays?: number;
  scopeChange?: ScopeChangeOut | null;
  onApplyScope?: (newMeetingIds: string[]) => void;
}

/**
 * Per-turn banners. Rendered below an assistant message when the response
 * carried a `scope_change` suggestion or the `out_of_window` flag.
 *
 * Both render as small inset cards rather than full-width strips — they're
 * contextual to a turn, not global state.
 */
export default function ScopeBanner({ outOfWindow, withinDays, scopeChange, onApplyScope }: ScopeBannerProps) {
  if (!outOfWindow && !scopeChange) return null;

  return (
    <div className="mt-2 flex flex-col gap-2">
      {outOfWindow && (
        <Card tone="warn">
          <p>
            <strong>Heads up:</strong> you asked about a date outside the
            searchable window. I can only see meetings from the last{' '}
            {withinDays ?? 30} days.
          </p>
        </Card>
      )}

      {scopeChange && (
        <Card tone="info">
          <p>{scopeChange.reason}</p>
          {onApplyScope && scopeChange.new_meeting_ids.length > 0 && (
            <button
              onClick={() => onApplyScope(scopeChange.new_meeting_ids)}
              className="mt-2 text-xs font-medium text-accent hover:underline"
            >
              Apply this scope ({scopeChange.new_meeting_ids.length} meeting
              {scopeChange.new_meeting_ids.length === 1 ? '' : 's'})
            </button>
          )}
        </Card>
      )}
    </div>
  );
}

function Card({ tone, children }: { tone: 'info' | 'warn'; children: React.ReactNode }) {
  const cls =
    tone === 'warn'
      ? 'border-yellow-500/40 bg-yellow-500/5 text-yellow-300'
      : 'border-accent/30 bg-accent/5 text-foreground';
  return (
    <div className={`rounded-md border px-3 py-2 text-xs ${cls}`}>
      {children}
    </div>
  );
}

'use client';

import type { AccessFilter } from '@/lib/chat-api';

const OPTIONS: { value: AccessFilter; label: string; hint: string }[] = [
  { value: 'all',      label: 'All',       hint: 'Everything you can see' },
  { value: 'attended', label: 'Attended',  hint: 'Only meetings you joined' },
  { value: 'granted',  label: 'Granted',   hint: 'Admin-granted access' },
];

export default function AccessFilterToggle({
  value,
  onChange,
}: {
  value: AccessFilter;
  onChange: (v: AccessFilter) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-bg p-0.5 text-xs">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          title={o.hint}
          className={`rounded-md px-2.5 py-1 transition-colors ${
            value === o.value
              ? 'bg-accent text-white'
              : 'text-muted hover:text-foreground'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

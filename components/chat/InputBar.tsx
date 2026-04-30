'use client';

import { useEffect, useRef, useState, KeyboardEvent, ChangeEvent } from 'react';

export interface MeetingOption {
  id: string;
  title: string;
}

interface InputBarProps {
  onSend: (text: string, meetingId?: string) => void;
  disabled?: boolean;
  variant?: 'centered' | 'bottom';
  meetings?: MeetingOption[];
}

const COMMANDS = [
  { cmd: '/meetings',  hint: 'List your ingested meetings' },
  { cmd: '/attended',  hint: 'Meetings you attended (last 30 days)' },
  { cmd: '/upcoming',  hint: 'Your upcoming scheduled meetings' },
  { cmd: '/help',      hint: 'Show available commands' },
];

export default function InputBar({ onSend, disabled, variant = 'bottom', meetings = [] }: InputBarProps) {
  const [value, setValue] = useState('');
  const [cmdIdx, setCmdIdx] = useState(0);
  const [mentionState, setMentionState] = useState<{ start: number; query: string } | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  const [scopedMeeting, setScopedMeeting] = useState<MeetingOption | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const cmdSuggestions = value.startsWith('/')
    ? COMMANDS.filter((c) => c.cmd.startsWith(value.toLowerCase().split(' ')[0]))
    : [];

  const mentionMatches = mentionState
    ? meetings
        .filter((m) => m.title.toLowerCase().includes(mentionState.query.toLowerCase()))
        .slice(0, 8)
    : [];

  useEffect(() => { setCmdIdx(0); }, [value]);
  useEffect(() => { setMentionIdx(0); }, [mentionState?.query]);

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const submit = (override?: string) => {
    const text = (override ?? value).trim();
    if (!text || disabled) return;
    onSend(text, scopedMeeting?.id);
    setValue('');
    setScopedMeeting(null);
    setMentionState(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const selectMeeting = (meeting: MeetingOption) => {
    if (!mentionState) return;
    const before = value.slice(0, mentionState.start);
    const after = value.slice(mentionState.start + 1 + mentionState.query.length);
    setValue(`${before}@${meeting.title}${after}`);
    setScopedMeeting(meeting);
    setMentionState(null);
    textareaRef.current?.focus();
    setTimeout(resize, 0);
  };

  const clearScope = () => {
    if (!scopedMeeting) return;
    setValue((v) => v.replace(`@${scopedMeeting.title}`, '').trimStart());
    setScopedMeeting(null);
    textareaRef.current?.focus();
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursor = e.target.selectionStart ?? val.length;
    setValue(val);
    resize();

    // Clear scope if @Title was removed from text
    if (scopedMeeting && !val.includes(`@${scopedMeeting.title}`)) {
      setScopedMeeting(null);
    }

    // Detect active @ mention (not inside a / command)
    if (!val.startsWith('/')) {
      const match = /@(\S*)$/.exec(val.slice(0, cursor));
      if (match) {
        setMentionState({ start: match.index, query: match[1] });
      } else {
        setMentionState(null);
      }
    } else {
      setMentionState(null);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionMatches.length > 0) {
      if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionIdx((i) => Math.max(0, i - 1)); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx((i) => Math.min(mentionMatches.length - 1, i + 1)); return; }
      if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); selectMeeting(mentionMatches[mentionIdx]); return; }
      if (e.key === 'Escape')    { setMentionState(null); return; }
    }

    if (cmdSuggestions.length > 0) {
      if (e.key === 'ArrowUp')   { e.preventDefault(); setCmdIdx((i) => Math.max(0, i - 1)); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setCmdIdx((i) => Math.min(cmdSuggestions.length - 1, i + 1)); return; }
      if (e.key === 'Tab')       { e.preventDefault(); setValue(cmdSuggestions[cmdIdx].cmd); return; }
    }

    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  const input = (
    <div className="relative">
      {/* @ meeting mention popup */}
      {mentionMatches.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1.5 bg-surface border border-border rounded-xl shadow-xl overflow-hidden z-50">
          <p className="px-4 py-2 text-[10px] text-muted font-medium uppercase tracking-wide border-b border-border">
            Scope to a meeting
          </p>
          {mentionMatches.map((m, i) => (
            <button
              key={m.id}
              onMouseDown={(e) => { e.preventDefault(); selectMeeting(m); }}
              className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                i === mentionIdx
                  ? 'bg-accent/10 text-foreground'
                  : 'text-muted hover:text-foreground hover:bg-accent/5'
              }`}
            >
              <span className="text-accent font-semibold text-xs shrink-0">@</span>
              <span className="truncate">{m.title}</span>
            </button>
          ))}
        </div>
      )}

      {/* Slash command palette */}
      {cmdSuggestions.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1.5 bg-surface border border-border rounded-xl shadow-xl overflow-hidden z-50">
          {cmdSuggestions.map((s, i) => (
            <button
              key={s.cmd}
              onMouseDown={(e) => { e.preventDefault(); submit(s.cmd); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                i === cmdIdx
                  ? 'bg-accent/10 text-foreground'
                  : 'text-muted hover:text-foreground hover:bg-accent/5'
              }`}
            >
              <span className="font-mono text-accent text-xs font-semibold w-24 shrink-0">{s.cmd}</span>
              <span className="text-xs text-muted">{s.hint}</span>
            </button>
          ))}
        </div>
      )}

      <div className={`flex flex-col rounded-2xl border bg-surface px-4 py-3 transition-colors shadow-sm ${
        scopedMeeting ? 'border-accent/60' : 'border-border focus-within:border-accent/50'
      }`}>
        {/* Scope badge */}
        {scopedMeeting && (
          <div className="flex items-center gap-1.5 mb-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 border border-accent/30 px-2.5 py-0.5 text-xs text-accent font-medium">
              <span>@</span>
              <span className="max-w-[200px] truncate">{scopedMeeting.title}</span>
              <button
                onMouseDown={(e) => { e.preventDefault(); clearScope(); }}
                className="ml-0.5 hover:text-foreground transition-colors"
                aria-label="Clear meeting scope"
              >
                <XIcon className="w-3 h-3" />
              </button>
            </span>
            <span className="text-[10px] text-muted">Scoped to this meeting</span>
          </div>
        )}

        <div className="flex items-end gap-3">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={scopedMeeting ? 'Ask about this meeting…' : 'Ask about your meetings… type @ to scope, / for commands'}
            rows={1}
            disabled={disabled}
            className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted outline-none py-0.5 max-h-40 disabled:opacity-50"
          />
          <button
            onClick={() => submit()}
            disabled={disabled || !value.trim()}
            className="shrink-0 flex items-center justify-center h-8 w-8 rounded-xl bg-accent text-white hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Send"
          >
            <SendIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  if (variant === 'centered') {
    return (
      <div className="w-full">
        {input}
        <p className="text-center text-[10px] text-muted mt-2">
          Enter to send · Shift+Enter for new line · @ to scope · / for commands
        </p>
      </div>
    );
  }

  return (
    <div className="bg-bg px-6 py-4">
      <div className="mx-auto w-full max-w-3xl">
        {input}
        <p className="text-center text-[10px] text-muted mt-2">
          Enter to send · Shift+Enter for new line · @ to scope · / for commands
        </p>
      </div>
    </div>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

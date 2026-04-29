'use client';

import { useRef, useState, KeyboardEvent } from 'react';

interface InputBarProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  variant?: 'centered' | 'bottom';
}

export default function InputBar({ onSend, disabled, variant = 'bottom' }: InputBarProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const input = (
    <div className="flex items-end gap-3 rounded-2xl border border-border bg-surface px-4 py-3 focus-within:border-accent/50 transition-colors shadow-sm">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder="Ask about your meetings..."
        rows={1}
        disabled={disabled}
        className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted outline-none py-0.5 max-h-40 disabled:opacity-50"
      />
      <button
        onClick={submit}
        disabled={disabled || !value.trim()}
        className="shrink-0 flex items-center justify-center h-8 w-8 rounded-xl bg-accent text-white hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Send"
      >
        <SendIcon className="w-4 h-4" />
      </button>
    </div>
  );

  if (variant === 'centered') {
    return (
      <div className="w-full">
        {input}
        <p className="text-center text-[10px] text-muted mt-2">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    );
  }

  return (
    <div className="bg-bg px-6 py-4">
      <div className="mx-auto w-full max-w-3xl">
        {input}
        <p className="text-center text-[10px] text-muted mt-2">
          Enter to send · Shift+Enter for new line
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

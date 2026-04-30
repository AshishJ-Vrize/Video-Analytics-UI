'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CommandCard from '@/components/chat/CommandCard';
import type { CommandResultData } from '@/components/chat/CommandCard';

export interface MessageSource {
  source_type: string;
  meeting_id: string;
  meeting_title: string;
  meeting_date: string | null;
  speaker_name: string | null;
  timestamp_display: string | null;
  similarity_score: number | null;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'command';
  content: string;
  commandData?: CommandResultData;
  sources?: MessageSource[];
  suggestions?: string[];
}

interface ChatBubbleProps {
  message: Message;
  onEdit?: (id: string, newText: string) => void;
  onRegenerate?: (id: string) => void;
  onSourceClick?: (meetingId: string, meetingTitle: string) => void;
  onSuggestionClick?: (text: string) => void;
}

export default function ChatBubble({ message, onEdit, onRegenerate, onSourceClick, onSuggestionClick }: ChatBubbleProps) {
  if (message.role === 'command') return <CommandCard data={message.commandData!} />;

  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEditSubmit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== message.content) {
      onEdit?.(message.id, trimmed);
    }
    setEditing(false);
  };

  const handleEditCancel = () => {
    setEditValue(message.content);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex flex-col items-end gap-2">
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditSubmit(); }
            if (e.key === 'Escape') handleEditCancel();
          }}
          rows={3}
          autoFocus
          className="w-full max-w-[75%] rounded-2xl border border-accent/60 bg-surface text-foreground text-sm px-4 py-3 resize-none outline-none leading-relaxed"
        />
        <div className="flex gap-2">
          <button
            onClick={handleEditCancel}
            className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleEditSubmit}
            className="text-xs px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-red-700 transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col group ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm
          ${isUser
            ? 'bg-surface border border-accent/60 text-foreground rounded-br-sm'
            : 'bg-bubble-assistant text-foreground rounded-bl-sm'
          }`}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap leading-relaxed">{message.content}</span>
        ) : (
          <div className="markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Source cards — assistant only */}
      {!isUser && message.sources && message.sources.length > 0 && (
        <div className="flex gap-2 flex-wrap mt-2 max-w-[75%]">
          {message.sources.map((s, i) => (
            <button
              key={`${s.meeting_id}-${i}`}
              onClick={() => onSourceClick?.(s.meeting_id, s.meeting_title)}
              className="text-left rounded-xl border border-border bg-surface px-3 py-2.5 hover:border-accent/50 hover:bg-accent/5 transition-all min-w-[160px] max-w-[200px]"
            >
              <p className="text-xs font-medium text-foreground truncate">{s.meeting_title || 'Untitled'}</p>
              {s.meeting_date && (
                <p className="text-[11px] text-muted mt-0.5">{fmtDate(s.meeting_date)}</p>
              )}
              {s.source_type !== 'metadata' && s.speaker_name && (
                <p className="text-[11px] text-muted mt-0.5 truncate">
                  {s.speaker_name}{s.timestamp_display ? ` · ${s.timestamp_display}` : ''}
                </p>
              )}
              {s.similarity_score != null && (
                <p className="text-[11px] text-accent/80 mt-1">
                  {Math.round(s.similarity_score * 100)}% match
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Suggestion pills — assistant only, aligned right */}
      {!isUser && message.suggestions && message.suggestions.length > 0 && (
        <div className="flex gap-2 flex-wrap mt-2 justify-end w-full">
          {message.suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => onSuggestionClick?.(s)}
              className="rounded-full border border-border px-3 py-1.5 text-xs text-muted hover:border-accent/50 hover:text-foreground hover:bg-accent/5 transition-all"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Action buttons — visible on hover */}
      <div className={`flex gap-0.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity
        ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      >
        <ActionButton onClick={handleCopy} label={copied ? 'Copied!' : 'Copy'}>
          {copied
            ? <CheckIcon className="w-3.5 h-3.5 text-green-500" />
            : <CopyIcon className="w-3.5 h-3.5" />
          }
        </ActionButton>

        {isUser && onEdit && (
          <ActionButton onClick={() => setEditing(true)} label="Edit">
            <EditIcon className="w-3.5 h-3.5" />
          </ActionButton>
        )}

        {!isUser && onRegenerate && (
          <ActionButton onClick={() => onRegenerate(message.id)} label="Regenerate">
            <RegenerateIcon className="w-3.5 h-3.5" />
          </ActionButton>
        )}
      </div>
    </div>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function ActionButton({ onClick, label, children }: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="p-1.5 rounded-md text-muted hover:text-foreground hover:bg-accent/8 transition-colors"
    >
      {children}
    </button>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function RegenerateIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-4" />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

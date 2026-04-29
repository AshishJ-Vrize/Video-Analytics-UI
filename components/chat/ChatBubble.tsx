'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatBubbleProps {
  message: Message;
  onEdit?: (id: string, newText: string) => void;
  onRegenerate?: (id: string) => void;
}

export default function ChatBubble({ message, onEdit, onRegenerate }: ChatBubbleProps) {
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

'use client';

import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SourcesCard from './SourcesCard';
import ScopeBanner from './ScopeBanner';
import type { ScopeChangeOut, SourceOut } from '@/lib/chat-api';

export interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceOut[];
  scopeChange?: ScopeChangeOut | null;
  outOfWindow?: boolean;
  withinDays?: number;            // CHAT_RBAC_WITHIN_DAYS at request time
  pending?: boolean;
  error?: boolean;
  /** Original text that produced this assistant turn — used by retry. */
  originalQuery?: string;
}

interface ChatThreadProps {
  turns: ChatTurn[];
  onApplyScope: (ids: string[]) => void;
  onRetry: (turn: ChatTurn) => void;
}

export default function ChatThread({ turns, onApplyScope, onRetry }: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Autoscroll to bottom on every new turn.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  if (turns.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-center">
        <div className="max-w-md text-muted">
          <h3 className="text-foreground text-base font-medium">Ask about your meetings</h3>
          <p className="mt-2 text-sm">
            Try <code className="text-accent">/help</code>, <code className="text-accent">/meetings</code>,
            or <code className="text-accent">/attended</code> — or just type a question.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {turns.map((t) => (
          <Bubble
            key={t.id}
            turn={t}
            onApplyScope={onApplyScope}
            onRetry={onRetry}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function Bubble({
  turn,
  onApplyScope,
  onRetry,
}: {
  turn: ChatTurn;
  onApplyScope: (ids: string[]) => void;
  onRetry: (turn: ChatTurn) => void;
}) {
  const isUser = turn.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
          isUser
            ? 'bg-accent text-white'
            : 'bg-bubble-assistant text-foreground'
        }`}
      >
        {turn.pending ? (
          <Dots />
        ) : isUser ? (
          <p className="whitespace-pre-wrap">{turn.content}</p>
        ) : (
          <>
            <div className="markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.content}</ReactMarkdown>
            </div>
            {turn.sources && <SourcesCard sources={turn.sources} />}
            <ScopeBanner
              outOfWindow={turn.outOfWindow}
              withinDays={turn.withinDays}
              scopeChange={turn.scopeChange}
              onApplyScope={onApplyScope}
            />
            {turn.error && turn.originalQuery && (
              <button
                onClick={() => onRetry(turn)}
                className="mt-2 text-xs font-medium text-accent hover:underline"
              >
                Retry
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Dots() {
  return (
    <span className="inline-flex gap-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
    </span>
  );
}

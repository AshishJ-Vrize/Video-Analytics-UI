'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { loginRequest } from '@/lib/msal-config';
import {
  listMeetings,
  postChat,
  type ChatResponse,
  type MeetingItem,
  type AccessFilter,
  type RbacScopeInfoOut,
} from '@/lib/chat-api';
import Sidebar from '@/components/chat/Sidebar';
import ChatThread, { type ChatTurn } from '@/components/chat/ChatThread';
import ChatInput from '@/components/chat/ChatInput';
import AccessFilterToggle from '@/components/chat/AccessFilterToggle';

const HELP_TEXT = `**Available commands**

- **/help** — show this message
- **/meetings** — list all meetings you have access to
- **/attended** — list meetings you actually attended

You can also just ask in plain English ("what did Sarah say about pricing?",
"summarise yesterday's standup", "compare these two demos").

**Tips**
- Click meetings on the left to scope your question to them.
- Use the All / Attended / Granted toggle to filter what's searchable.
- Ask follow-ups — the bot remembers prior turns in this session.`;

export default function ChatPage() {
  const { instance, accounts, inProgress } = useMsal();
  const router = useRouter();

  // Auth
  const [idToken, setIdToken] = useState<string | null>(null);

  // Sidebar
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Chat
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [accessFilter, setAccessFilter] = useState<AccessFilter>('all');
  const [sending, setSending] = useState(false);
  const [rbacInfo, setRbacInfo] = useState<RbacScopeInfoOut | null>(null);

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (inProgress === InteractionStatus.None && accounts.length === 0) {
      router.replace('/login');
    }
  }, [accounts, inProgress, router]);

  // ── Acquire token + load meetings ──────────────────────────────────────────
  useEffect(() => {
    if (inProgress !== InteractionStatus.None || accounts.length === 0) return;
    let cancelled = false;

    (async () => {
      try {
        const tokenRes = await instance.acquireTokenSilent({
          ...loginRequest,
          account: accounts[0],
        });
        if (cancelled) return;
        setIdToken(tokenRes.idToken);

        const list = await listMeetings(tokenRes.idToken, 'both');
        if (!cancelled) setMeetings(list);
      } catch (err) {
        console.error('chat: load failed', err);
      } finally {
        if (!cancelled) setLoadingMeetings(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inProgress, accounts]);

  // ── Sidebar handlers ───────────────────────────────────────────────────────
  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const applyScope = useCallback((newIds: string[]) => {
    setSelectedIds(new Set(newIds));
  }, []);

  // ── Send the current draft to the backend ──────────────────────────────────
  const sendQuery = useCallback(async (
    rawText: string,
    opts?: { resendOfTurnId?: string },
  ) => {
    if (!idToken) return;

    // /help → client-only, no API
    if (rawText === '/help') {
      setTurns((prev) => [
        ...prev,
        { id: makeId(), role: 'user', content: rawText },
        { id: makeId(), role: 'assistant', content: HELP_TEXT },
      ]);
      return;
    }

    // Map slash commands to canned queries + filter overrides.
    let query = rawText;
    let perRequestFilter: AccessFilter = accessFilter;
    let perRequestSelection: string[] | null | undefined =
      selectedIds.size > 0 ? Array.from(selectedIds) : undefined;

    if (rawText === '/meetings') {
      query = 'List all my meetings.';
      perRequestSelection = null;
      perRequestFilter = 'all';
    } else if (rawText === '/attended') {
      query = 'List the meetings I attended.';
      perRequestSelection = null;
      perRequestFilter = 'attended';
    }

    const userTurnId = opts?.resendOfTurnId ? null : makeId();
    const pendingId = makeId();

    setTurns((prev) => {
      // On retry, drop the failed assistant turn before adding the new pending one.
      const cleaned = opts?.resendOfTurnId
        ? prev.filter((t) => t.id !== opts.resendOfTurnId)
        : prev;
      const userTurn: ChatTurn[] = userTurnId
        ? [{ id: userTurnId, role: 'user', content: rawText }]
        : [];
      return [
        ...cleaned,
        ...userTurn,
        { id: pendingId, role: 'assistant', content: '', pending: true, originalQuery: rawText },
      ];
    });
    setSending(true);

    try {
      const resp: ChatResponse = await postChat(idToken, {
        query,
        selected_meeting_ids: perRequestSelection,
        access_filter: perRequestFilter,
        session_id: sessionId,
      });
      setSessionId(resp.session_id);
      setRbacInfo(resp.rbac_scope_info);
      setTurns((prev) =>
        prev.map((t) =>
          t.id === pendingId
            ? {
                ...t,
                content: resp.answer,
                sources: resp.sources,
                scopeChange: resp.scope_change,
                outOfWindow: resp.out_of_window,
                withinDays: resp.rbac_scope_info?.within_days,
                pending: false,
              }
            : t,
        ),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Request failed.';
      setTurns((prev) =>
        prev.map((t) =>
          t.id === pendingId
            ? { ...t, content: `_Error:_ ${msg}`, pending: false, error: true }
            : t,
        ),
      );
    } finally {
      setSending(false);
    }
  }, [accessFilter, idToken, selectedIds, sessionId]);

  const handleSubmit = useCallback((text: string) => sendQuery(text), [sendQuery]);

  const handleRetry = useCallback((turn: ChatTurn) => {
    if (!turn.originalQuery) return;
    sendQuery(turn.originalQuery, { resendOfTurnId: turn.id });
  }, [sendQuery]);

  return (
    <main className="flex h-screen w-full bg-bg text-foreground">
      <Sidebar
        meetings={meetings}
        selectedIds={selectedIds}
        onToggle={toggleSelected}
        onClearAll={clearSelection}
        loading={loadingMeetings}
      />
      <section className="flex flex-1 flex-col">
        <header className="flex flex-col gap-2 border-b border-border bg-surface px-6 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-semibold">Chat</h1>
            <div className="flex items-center gap-3">
              <AccessFilterToggle value={accessFilter} onChange={setAccessFilter} />
              <a href="/ingest" className="text-xs text-muted hover:text-foreground">Ingest →</a>
            </div>
          </div>
          {rbacInfo?.capped && (
            <div className="rounded-md border border-accent/30 bg-accent/5 px-3 py-1.5 text-xs text-foreground">
              Showing the {rbacInfo.visible} most-recent of {rbacInfo.total} accessible
              meetings (last {rbacInfo.within_days} days). Older meetings are outside
              the searchable window.
            </div>
          )}
        </header>
        <ChatThread
          turns={turns}
          onApplyScope={applyScope}
          onRetry={handleRetry}
        />
        <ChatInput onSubmit={handleSubmit} disabled={sending || !idToken} />
      </section>
    </main>
  );
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

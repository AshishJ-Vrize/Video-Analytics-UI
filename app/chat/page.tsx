'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import { InteractionRequiredAuthError, InteractionStatus } from '@azure/msal-browser';
import { loginRequest } from '@/lib/msal-config';
import Sidebar, { Conversation } from '@/components/chat/Sidebar';
import TopBar from '@/components/chat/TopBar';
import ChatBubble, { Message, MessageSource } from '@/components/chat/ChatBubble';
import InputBar, { MeetingOption } from '@/components/chat/InputBar';
import type { CommandResultData } from '@/components/chat/CommandCard';
import { fetchCalendarEvents } from '@/lib/graph';

const SUGGESTIONS = [
  'Summarize my last meeting',
  'What were the action items?',
  'Who spoke the most?',
  'Show key decisions made',
];

export default function ChatPage() {
  const { instance, accounts, inProgress } = useMsal();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [meetings, setMeetings] = useState<MeetingOption[]>([]);
  const [activeScopeMeetingId, setActiveScopeMeetingId] = useState<string | undefined>(undefined);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isEmpty = messages.length === 0 && !loading;

  // Auth guard — redirect to /login if no account after MSAL finishes loading
  useEffect(() => {
    if (inProgress === InteractionStatus.None && accounts.length === 0) {
      router.replace('/login');
    }
  }, [accounts, inProgress, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Persist active session across refreshes
  useEffect(() => {
    if (activeId) {
      localStorage.setItem('va_chat_active', activeId);
    } else {
      localStorage.removeItem('va_chat_active');
    }
  }, [activeId]);

  // Load past sessions once MSAL is ready, then restore last active session
  useEffect(() => {
    if (sessionsLoaded) return;
    if (inProgress !== InteractionStatus.None || accounts.length === 0) return;

    setSessionsLoaded(true);
    getToken()
      .then(async (token) => {
        const headers = { Authorization: `Bearer ${token}` };
        const base = process.env.NEXT_PUBLIC_API_BASE_URL;
        const [sessionsRes, meetingsRes] = await Promise.all([
          fetch(`${base}/chat/sessions`, { headers }),
          fetch(`${base}/api/v1/meetings`, { headers }),
        ]);
        const sessions: { id: string; title: string }[] = sessionsRes.ok ? await sessionsRes.json() : [];
        const meetingItems: { id: string; meeting_subject: string }[] = meetingsRes.ok ? await meetingsRes.json() : [];
        return { sessions, meetingItems };
      })
      .then(({ sessions, meetingItems }) => {
        setConversations(sessions.map((s) => ({ id: s.id, title: s.title })));
        setMeetings(meetingItems.map((m) => ({ id: String(m.id), title: m.meeting_subject })));

        const savedId = localStorage.getItem('va_chat_active');
        const targetId =
          savedId && sessions.find((s) => s.id === savedId)
            ? savedId
            : sessions[0]?.id ?? null;

        if (targetId) handleSelectConversation(targetId);
      })
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inProgress, accounts, sessionsLoaded]);

  const getToken = async (): Promise<string> => {
    try {
      const response = await instance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      });
      return response.idToken;
    } catch (err) {
      if (err instanceof InteractionRequiredAuthError) {
        await instance.loginRedirect(loginRequest);
      }
      throw err;
    }
  };

  const handleSelectConversation = async (id: string) => {
    setActiveId(id);
    setMessages([]);
    try {
      const token = await getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/chat/sessions/${id}/messages`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return;
      const msgs: { id: string; role: string; content: string; citations?: MessageSource[] }[] = await res.json();
      setMessages(
        msgs.map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          sources: m.citations ?? [],
        }))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
    try {
      const token = await getToken();
      await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/chat/sessions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (messageId: string, newText: string) => {
    const index = messages.findIndex((m) => m.id === messageId);
    if (index === -1) return;
    setMessages((prev) => prev.slice(0, index));
    handleSend(newText);
  };

  const handleRegenerate = (messageId: string) => {
    const index = messages.findIndex((m) => m.id === messageId);
    if (index === -1) return;
    const prevUserMsg = messages.slice(0, index).findLast((m) => m.role === 'user');
    if (!prevUserMsg) return;
    setMessages((prev) => prev.slice(0, index));
    handleSend(prevUserMsg.content);
  };

  const handleCommand = async (cmd: string) => {
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: cmd };
    const resultId = crypto.randomUUID();
    const loadingMsg: Message = { id: resultId, role: 'command', content: '', commandData: { type: 'loading' } };
    setMessages((prev) => [...prev, userMsg, loadingMsg]);

    let result: CommandResultData;
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL;
      const token = await getToken();

      if (cmd === '/help') {
        result = { type: 'help' };

      } else if (cmd === '/meetings') {
        const res = await fetch(`${base}/api/v1/meetings`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error();
        result = { type: 'meetings', meetings: await res.json() };

      } else if (cmd === '/attended' || cmd === '/upcoming') {
        // Get graph token for calendar
        let graphToken: string;
        try {
          const gr = await instance.acquireTokenSilent({
            scopes: ['Calendars.Read'],
            account: accounts[0],
          });
          graphToken = gr.accessToken;
        } catch {
          const gr = await instance.acquireTokenPopup({
            scopes: ['Calendars.Read'],
            account: accounts[0],
          });
          graphToken = gr.accessToken;
        }

        const now = new Date();
        if (cmd === '/upcoming') {
          const future = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
          const events = await fetchCalendarEvents(graphToken, now, future);
          result = { type: 'upcoming', events };
        } else {
          // /attended — past 30 days
          const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          const [events, meetingsRes] = await Promise.all([
            fetchCalendarEvents(graphToken, past, now),
            fetch(`${base}/api/v1/meetings`, { headers: { Authorization: `Bearer ${token}` } }),
          ]);
          const meetings = meetingsRes.ok ? await meetingsRes.json() : [];
          const ingestedJoinUrls = new Set<string>(
            meetings.map((m: { join_url: string | null }) => m.join_url).filter(Boolean)
          );
          result = { type: 'attended', events, ingestedJoinUrls };
        }

      } else {
        result = { type: 'error', message: `Unknown command: "${cmd}". Type /help to see available commands.` };
      }
    } catch {
      result = { type: 'error', message: 'Command failed. Please try again.' };
    }

    setMessages((prev) =>
      prev.map((m) => (m.id === resultId ? { ...m, commandData: result } : m))
    );
  };

  const handleSend = async (text: string, meetingId?: string) => {
    if (text.startsWith('/')) {
      await handleCommand(text.trim().toLowerCase());
      return;
    }

    // Track active meeting scope so suggestion-pill follow-ups stay scoped
    setActiveScopeMeetingId(meetingId);

    const wasNew = activeId === null;
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: text,
          session_id: activeId ?? undefined,
          meeting_id: meetingId ?? undefined,
        }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      const sessionId: string = data.session_id;

      if (wasNew) {
        setActiveId(sessionId);
        setConversations((prev) => [{ id: sessionId, title: text.slice(0, 60) }, ...prev]);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.answer,
          sources: (data.sources ?? []) as MessageSource[],
          suggestions: data.suggestions ?? [],
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: 'Something went wrong. Please try again.' },
      ]);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={handleSelectConversation}
        onNewChat={() => { setActiveId(null); setMessages([]); setActiveScopeMeetingId(undefined); localStorage.removeItem('va_chat_active'); }}
        onDelete={handleDeleteConversation}
        onRename={(id, title) =>
          setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)))
        }
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-col flex-1 min-w-0">
        <TopBar onToggleSidebar={() => setSidebarOpen((o) => !o)} />

        {isEmpty ? (
          <div className="flex flex-col flex-1 items-center justify-center px-6 pb-12 gap-6">
            <div className="text-center">
              <h1 className="text-2xl font-semibold text-foreground">What are you working on?</h1>
              <p className="text-sm text-muted mt-1">Ask anything about your meeting transcripts.</p>
            </div>

            <div className="w-full max-w-2xl">
              <InputBar onSend={handleSend} disabled={loading} variant="centered" meetings={meetings} />
            </div>

            <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="rounded-full border border-border px-4 py-1.5 text-sm text-muted hover:border-accent/50 hover:text-foreground hover:bg-accent/5 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto py-6">
              <div className="mx-auto w-full max-w-3xl px-6 space-y-4">
                {messages.map((msg, i) => {
                  const isLastAssistant =
                    msg.role === 'assistant' &&
                    messages.slice(i + 1).every((m) => m.role !== 'assistant');
                  return (
                    <ChatBubble
                      key={msg.id}
                      message={isLastAssistant ? msg : { ...msg, suggestions: [] }}
                      onEdit={handleEdit}
                      onRegenerate={handleRegenerate}
                      onSourceClick={(_meetingId, meetingTitle) =>
                        handleSend(`Tell me more about the "${meetingTitle}" meeting`)
                      }
                      onSuggestionClick={(text) => handleSend(text, activeScopeMeetingId)}
                    />
                  );
                })}

                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-bubble-assistant rounded-2xl rounded-bl-sm px-4 py-3">
                      <TypingIndicator />
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            </div>

            <InputBar onSend={handleSend} disabled={loading} variant="bottom" meetings={meetings} />
          </>
        )}
      </div>
    </>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 h-4">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-muted animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

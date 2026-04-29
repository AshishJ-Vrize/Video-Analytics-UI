'use client';

import { useEffect, useRef, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { loginRequest } from '@/lib/msal-config';
import Sidebar, { Conversation } from '@/components/chat/Sidebar';
import TopBar from '@/components/chat/TopBar';
import ChatBubble, { Message } from '@/components/chat/ChatBubble';
import InputBar from '@/components/chat/InputBar';

const SUGGESTIONS = [
  'Summarize my last meeting',
  'What were the action items?',
  'Who spoke the most?',
  'Show key decisions made',
];

export default function ChatPage() {
  const { instance, accounts } = useMsal();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isEmpty = messages.length === 0 && !loading;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getToken = async () => {
    try {
      const response = await instance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      });
      return response.accessToken;
    } catch (err) {
      if (err instanceof InteractionRequiredAuthError) {
        await instance.loginRedirect(loginRequest);
      }
      throw err;
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

  const ensureConversation = () => {
    if (activeId) return activeId;
    const id = crypto.randomUUID();
    setConversations((prev) => [{ id, title: 'New conversation' }, ...prev]);
    setActiveId(id);
    return id;
  };

  const handleSend = async (text: string) => {
    const convId = ensureConversation();

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text };
    setMessages((prev) => {
      if (prev.length === 0) {
        setConversations((cs) =>
          cs.map((c) => (c.id === convId ? { ...c, title: text.slice(0, 40) } : c))
        );
      }
      return [...prev, userMsg];
    });
    setLoading(true);

    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text, conversation_id: convId }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: data.reply ?? data.message ?? 'No response.' },
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
        onSelect={(id) => { setActiveId(id); setMessages([]); }}
        onNewChat={() => { setActiveId(null); setMessages([]); }}
        onDelete={(id) => {
          setConversations((prev) => prev.filter((c) => c.id !== id));
          if (activeId === id) { setActiveId(null); setMessages([]); }
        }}
        onRename={(id, title) =>
          setConversations((prev) => prev.map((c) => c.id === id ? { ...c, title } : c))
        }
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-col flex-1 min-w-0">
        <TopBar onToggleSidebar={() => setSidebarOpen((o) => !o)} />

        {isEmpty ? (
          /* ── Centered empty state ── */
          <div className="flex flex-col flex-1 items-center justify-center px-6 pb-12 gap-6">
            <div className="text-center">
              <h1 className="text-2xl font-semibold text-foreground">What are you working on?</h1>
              <p className="text-sm text-muted mt-1">Ask anything about your meeting transcripts.</p>
            </div>

            <div className="w-full max-w-2xl">
              <InputBar onSend={handleSend} disabled={loading} variant="centered" />
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
          /* ── Active conversation state ── */
          <>
            <div className="flex-1 overflow-y-auto py-6">
              <div className="mx-auto w-full max-w-3xl px-6 space-y-4">
                {messages.map((msg) => (
                  <ChatBubble key={msg.id} message={msg} onEdit={handleEdit} onRegenerate={handleRegenerate} />
                ))}

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

            <InputBar onSend={handleSend} disabled={loading} variant="bottom" />
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

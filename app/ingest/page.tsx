'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import { InteractionRequiredAuthError, InteractionStatus } from '@azure/msal-browser';
import { loginRequest, graphRequest } from '@/lib/msal-config';
import { fetchCalendarEvents, type CalendarEvent } from '@/lib/graph';

type IngestState = 'idle' | 'loading' | 'done' | 'pending' | 'error';

interface IngestedMeeting {
  id: string;
  meeting_subject: string;
  join_url: string | null;
}

export default function IngestPage() {
  const { instance, accounts, inProgress } = useMsal();
  const router = useRouter();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [ingestedJoinUrls, setIngestedJoinUrls] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (inProgress === InteractionStatus.None && accounts.length === 0) {
      router.replace('/login');
    }
  }, [accounts, inProgress, router]);

  // Initial load — calendar events from Graph + already-ingested list from backend
  useEffect(() => {
    if (inProgress !== InteractionStatus.None || accounts.length === 0) return;
    let cancelled = false;

    (async () => {
      try {
        // Graph: last 30 days of online meetings
        const graphToken = await acquireGraphToken(instance, accounts);
        const end = new Date();
        const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const calendarEvents = await fetchCalendarEvents(graphToken, start, end);

        // Backend: meetings already in our DB (so we know which buttons start as "Ingested")
        const apiToken = (await instance.acquireTokenSilent({
          ...loginRequest,
          account: accounts[0],
        })).idToken;
        const base = process.env.NEXT_PUBLIC_API_BASE_URL;
        const res = await fetch(`${base}/api/v1/meetings`, {
          headers: { Authorization: `Bearer ${apiToken}` },
        });
        const ingested: IngestedMeeting[] = res.ok ? await res.json() : [];
        const joinUrls = new Set(
          ingested.map((m) => m.join_url).filter((u): u is string => Boolean(u))
        );

        if (!cancelled) {
          setEvents(calendarEvents);
          setIngestedJoinUrls(joinUrls);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setError('Failed to load meetings. Try refreshing.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inProgress, accounts]);

  return (
    <main className="min-h-screen bg-bg text-foreground p-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">Ingest meetings</h1>
          <p className="text-muted text-sm mt-1">
            Your Teams meetings from the last 30 days. Click Ingest to pull the
            transcript and run it through the analytics pipeline.
          </p>
        </header>

        {loading && <p className="text-muted text-sm">Loading…</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {!loading && !error && events.length === 0 && (
          <p className="text-muted text-sm">
            No Teams meetings found in the last 30 days.
          </p>
        )}

        <div className="space-y-2">
          {events.map((e) => {
            const ingested = e.onlineMeeting?.joinUrl
              ? ingestedJoinUrls.has(e.onlineMeeting.joinUrl)
              : false;
            return <AttendedRow key={e.id} event={e} ingested={ingested} />;
          })}
        </div>
      </div>
    </main>
  );
}

// ── AttendedRow ───────────────────────────────────────────────────────────────

function AttendedRow({ event, ingested }: { event: CalendarEvent; ingested: boolean }) {
  const { instance, accounts } = useMsal();
  const [state, setState] = useState<IngestState>(ingested ? 'done' : 'idle');
  const [msg, setMsg] = useState('');

  const doIngest = async (graphToken: string): Promise<Response> => {
    const idRes = await instance.acquireTokenSilent({ ...loginRequest, account: accounts[0] });
    return fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/ingest/meeting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idRes.idToken}`,
      },
      body: JSON.stringify({
        join_url: event.onlineMeeting!.joinUrl,
        graph_token: graphToken,
      }),
    });
  };

  const handleIngest = async () => {
    if (!event.onlineMeeting?.joinUrl) return;
    setState('loading');
    try {
      let graphToken = await acquireGraphToken(instance, accounts);
      let res = await doIngest(graphToken);

      // Token cached and expired on the backend — force-refresh and retry once.
      if (res.status === 401) {
        graphToken = await acquireGraphToken(instance, accounts, true);
        res = await doIngest(graphToken);
      }

      const data = await res.json();
      if (res.status === 202 || data.status === 'pending') {
        setState('pending');
        setMsg('Transcript not ready yet — Teams takes 5–10 min after a meeting ends.');
      } else if (res.ok) {
        setState('done');
      } else {
        setState('error');
        setMsg(data.detail ?? 'Ingestion failed.');
      }
    } catch (err) {
      console.error(err);
      setState('error');
      setMsg('Something went wrong.');
    }
  };

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3">
      <span
        className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
          state === 'done' ? 'bg-green-400'
          : state === 'pending' ? 'bg-yellow-400'
          : state === 'error' ? 'bg-red-400'
          : 'bg-muted'
        }`}
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate text-sm">{event.subject}</p>
        <p className="text-muted text-xs mt-0.5">
          {fmtDate(event.start.dateTime)} · {fmtTime(event.start.dateTime)}
          {event.organizer ? ` · ${event.organizer.emailAddress.name}` : ''}
        </p>
        {(state === 'pending' || state === 'error') && (
          <p className={`text-xs mt-0.5 ${state === 'error' ? 'text-red-400' : 'text-yellow-400'}`}>
            {msg}
          </p>
        )}
      </div>
      {state === 'idle' && event.onlineMeeting?.joinUrl && (
        <button
          onClick={handleIngest}
          className="shrink-0 text-xs px-3 py-1.5 rounded-md border border-accent/40 text-accent hover:bg-accent/10 transition-colors"
        >
          Ingest
        </button>
      )}
      {state === 'error' && event.onlineMeeting?.joinUrl && (
        <button
          onClick={() => { setState('idle'); setMsg(''); }}
          className="shrink-0 text-xs px-3 py-1.5 rounded-md border border-border text-muted hover:text-foreground"
        >
          Retry
        </button>
      )}
      {state === 'loading' && <Spinner />}
      {state === 'done' && <span className="shrink-0 text-xs text-green-400 px-2">Ingested</span>}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function acquireGraphToken(
  instance: ReturnType<typeof useMsal>['instance'],
  accounts: ReturnType<typeof useMsal>['accounts'],
  forceRefresh = false,
): Promise<string> {
  try {
    const res = await instance.acquireTokenSilent({
      ...graphRequest,
      account: accounts[0],
      forceRefresh,
    });
    return res.accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      const res = await instance.acquireTokenPopup({ ...graphRequest, account: accounts[0] });
      return res.accessToken;
    }
    throw err;
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function Spinner() {
  return (
    <svg
      className="w-4 h-4 animate-spin text-muted shrink-0 mt-1"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

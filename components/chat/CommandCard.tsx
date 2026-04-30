'use client';

import { useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { loginRequest, graphRequest } from '@/lib/msal-config';
import type { CalendarEvent } from '@/lib/graph';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IngestedMeeting {
  id: string;
  meeting_subject: string;
  meeting_date: string;
  duration_minutes: number | null;
  status: string;
  your_role: string;
  join_url: string | null;
}

export type CommandResultData =
  | { type: 'loading' }
  | { type: 'help' }
  | { type: 'error'; message: string }
  | { type: 'meetings'; meetings: IngestedMeeting[] }
  | { type: 'attended'; events: CalendarEvent[]; ingestedJoinUrls: Set<string> }
  | { type: 'upcoming'; events: CalendarEvent[] };

interface Props {
  data: CommandResultData;
}

const COMMANDS = [
  { cmd: '/meetings',  hint: 'List your ingested meetings' },
  { cmd: '/attended',  hint: 'Meetings you attended (last 30 days)' },
  { cmd: '/upcoming',  hint: 'Your upcoming scheduled meetings' },
  { cmd: '/help',      hint: 'Show available commands' },
];

export default function CommandCard({ data }: Props) {
  const wrapper = 'rounded-2xl rounded-bl-sm border border-border bg-surface px-4 py-3 text-sm max-w-[90%]';

  if (data.type === 'loading') {
    return (
      <div className={wrapper}>
        <div className="flex items-center gap-2 text-muted">
          <SpinnerIcon className="w-4 h-4 animate-spin" />
          Running command…
        </div>
      </div>
    );
  }

  if (data.type === 'error') {
    return (
      <div className={`${wrapper} border-red-500/30`}>
        <p className="text-red-400">{data.message}</p>
      </div>
    );
  }

  if (data.type === 'help') {
    return (
      <div className={wrapper}>
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Available commands</p>
        <div className="space-y-1.5">
          {COMMANDS.map((c) => (
            <div key={c.cmd} className="flex items-center gap-3">
              <span className="font-mono text-accent text-xs w-24 shrink-0">{c.cmd}</span>
              <span className="text-muted text-xs">{c.hint}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.type === 'meetings') {
    return (
      <div className={wrapper}>
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
          Ingested meetings ({data.meetings.length})
        </p>
        {data.meetings.length === 0 ? (
          <p className="text-muted text-xs">No meetings ingested yet. Use /attended to ingest one.</p>
        ) : (
          <div className="space-y-1.5">
            {data.meetings.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg bg-bg px-3 py-2">
                <StatusDot status={m.status} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate text-xs">{m.meeting_subject}</p>
                  <p className="text-muted text-[11px] mt-0.5">
                    {fmtDate(m.meeting_date)}
                    {m.duration_minutes ? ` · ${m.duration_minutes} min` : ''}
                    {' · '}{m.your_role}
                  </p>
                </div>
                <StatusBadge status={m.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (data.type === 'upcoming') {
    return (
      <div className={wrapper}>
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
          Upcoming meetings ({data.events.length})
        </p>
        {data.events.length === 0 ? (
          <p className="text-muted text-xs">No upcoming Teams meetings in the next 14 days.</p>
        ) : (
          <div className="space-y-1.5">
            {data.events.map((e) => (
              <div key={e.id} className="flex items-center gap-3 rounded-lg bg-bg px-3 py-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate text-xs">{e.subject}</p>
                  <p className="text-muted text-[11px] mt-0.5">
                    {fmtDate(e.start.dateTime)} · {fmtTime(e.start.dateTime)} – {fmtTime(e.end.dateTime)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (data.type === 'attended') {
    return (
      <div className={wrapper}>
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
          Attended meetings — last 30 days ({data.events.length})
        </p>
        {data.events.length === 0 ? (
          <p className="text-muted text-xs">No Teams meetings found in the last 30 days.</p>
        ) : (
          <div className="space-y-1.5">
            {data.events.map((e) => {
              const ingested = e.onlineMeeting?.joinUrl
                ? data.ingestedJoinUrls.has(e.onlineMeeting.joinUrl)
                : false;
              return (
                <AttendedRow
                  key={e.id}
                  event={e}
                  ingested={ingested}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ── AttendedRow — has its own ingest logic ─────────────────────────────────────

type IngestState = 'idle' | 'loading' | 'done' | 'pending' | 'error';

function AttendedRow({ event, ingested }: { event: CalendarEvent; ingested: boolean }) {
  const { instance, accounts } = useMsal();
  const [state, setState] = useState<IngestState>(ingested ? 'done' : 'idle');
  const [msg, setMsg] = useState('');

  const acquireGraphToken = async (forceRefresh = false): Promise<string> => {
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
  };

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
      let graphToken = await acquireGraphToken();
      let res = await doIngest(graphToken);

      // Token was cached and expired on the backend — force-refresh and retry once
      if (res.status === 401) {
        graphToken = await acquireGraphToken(true);
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
      setState('error');
      setMsg('Something went wrong.');
      console.error(err);
    }
  };

  return (
    <div className="flex items-start gap-3 rounded-lg bg-bg px-3 py-2">
      <span className={`w-2 h-2 rounded-full shrink-0 mt-1 ${
        state === 'done' ? 'bg-green-400' :
        state === 'pending' ? 'bg-yellow-400' :
        state === 'error' ? 'bg-red-400' : 'bg-muted'
      }`} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate text-xs">{event.subject}</p>
        <p className="text-muted text-[11px] mt-0.5">
          {fmtDate(event.start.dateTime)} · {fmtTime(event.start.dateTime)}
          {event.organizer ? ` · ${event.organizer.emailAddress.name}` : ''}
        </p>
        {(state === 'pending' || state === 'error') && (
          <p className={`text-[11px] mt-0.5 ${state === 'error' ? 'text-red-400' : 'text-yellow-400'}`}>{msg}</p>
        )}
      </div>
      {state === 'idle' && event.onlineMeeting?.joinUrl && (
        <button
          onClick={handleIngest}
          className="shrink-0 text-[11px] px-2.5 py-1 rounded-md border border-accent/40 text-accent hover:bg-accent/10 transition-colors"
        >
          Ingest
        </button>
      )}
      {state === 'error' && event.onlineMeeting?.joinUrl && (
        <button
          onClick={() => { setState('idle'); setMsg(''); }}
          className="shrink-0 text-[11px] px-2.5 py-1 rounded-md border border-border text-muted hover:text-foreground transition-colors"
        >
          Retry
        </button>
      )}
      {state === 'loading' && (
        <SpinnerIcon className="w-3.5 h-3.5 animate-spin text-muted shrink-0 mt-0.5" />
      )}
      {state === 'done' && (
        <span className="shrink-0 text-[11px] text-green-400">Ingested</span>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function StatusDot({ status }: { status: string }) {
  const c = status === 'ready' ? 'bg-green-400' : status === 'pending' ? 'bg-yellow-400' : status === 'failed' ? 'bg-red-400' : 'bg-muted';
  return <span className={`w-2 h-2 rounded-full shrink-0 ${c}`} />;
}

function StatusBadge({ status }: { status: string }) {
  const c = status === 'ready' ? 'border-green-500/30 text-green-400' : status === 'pending' ? 'border-yellow-500/30 text-yellow-400' : status === 'failed' ? 'border-red-500/30 text-red-400' : 'border-border text-muted';
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 ${c}`}>{status}</span>;
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

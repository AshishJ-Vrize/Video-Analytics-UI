// Typed client for the backend chat + meetings endpoints.
//
// Wire shapes mirror the FastAPI `ChatResponse` / `MeetingItem` Pydantic models
// in va-test-2/app/api/routes/{chat,meetings}.py. If you change a field there,
// update it here.

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;

// ── Wire types ──────────────────────────────────────────────────────────────

export type AccessFilter = 'all' | 'attended' | 'granted';

export interface MeetingItem {
  id: string;
  meeting_graph_id: string;
  organizer_name: string | null;
  organizer_email: string | null;
  meeting_subject: string;
  meeting_date: string;          // ISO
  meeting_end_date: string | null;
  duration_minutes: number | null;
  status: string;
  ingestion_source: string;
  your_role: string;             // 'organizer' | 'attendee' | 'granted'
  join_url: string | null;
}

export interface ChatRequest {
  query: string;
  selected_meeting_ids?: string[] | null;
  access_filter?: AccessFilter;
  session_id?: string | null;
}

export interface SourceTimespan { start_ms: number; end_ms: number; }

export interface SourceOut {
  meeting_id: string;
  meeting_title: string;
  meeting_date: string | null;
  source_type: string;
  speakers: string[];
  timespans: SourceTimespan[];
}

export interface ScopeChangeOut {
  new_meeting_ids: string[];
  reason: string;
}

export interface RbacScopeInfoOut {
  total: number;
  visible: number;
  capped: boolean;
  within_days: number;
  max_meetings: number;
}

export interface ChatResponse {
  session_id: string;
  answer: string;
  route: string;
  sources: SourceOut[];
  scope_change: ScopeChangeOut | null;
  out_of_window: boolean;
  speaker_disambiguation: { name: string; email: string | null; graph_id: string }[] | null;
  rbac_scope_info: RbacScopeInfoOut | null;
}

// ── Calls ───────────────────────────────────────────────────────────────────

export async function listMeetings(
  idToken: string,
  filter: 'participated' | 'granted' | 'both' = 'participated',
): Promise<MeetingItem[]> {
  const res = await fetch(`${API_BASE}/api/v1/meetings?filter=${filter}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`listMeetings failed: ${res.status}`);
  return res.json();
}

export async function postChat(idToken: string, body: ChatRequest): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      if (j?.detail) detail = j.detail;
    } catch { /* ignore */ }
    throw new Error(detail);
  }
  return res.json();
}

const GRAPH = 'https://graph.microsoft.com/v1.0';

export interface CalendarEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  organizer?: { emailAddress: { name: string; address: string } };
  onlineMeeting?: { joinUrl: string };
  isOnlineMeeting?: boolean;
}

export async function fetchCalendarEvents(
  token: string,
  start: Date,
  end: Date,
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
    '$select': 'id,subject,start,end,onlineMeeting,organizer,isOnlineMeeting',
    '$orderby': 'start/dateTime desc',
    '$top': '25',
  });

  const res = await fetch(`${GRAPH}/me/calendarView?${params}`, {
    headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="UTC"' },
  });

  if (!res.ok) throw new Error(`Graph calendar error: ${res.status}`);
  const data = await res.json();
  return (data.value as CalendarEvent[]).filter(
    (e) => e.isOnlineMeeting || e.onlineMeeting?.joinUrl
  );
}

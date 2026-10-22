import { getEventByCode } from './events';
import { parseQRPayload } from './qr';
import { supabase } from './supabase';

export type AttendanceStatus = 'present' | 'late' | 'absent';

export type AttendanceRecord = {
  id: string;
  eventId: string;
  eventTitle: string;
  scannedAt: string;
  status: AttendanceStatus;
};

export type RegisterResult = {
  success: boolean;
  message: string;
  eventTitle?: string;
};

export type TeacherEventAttendance = {
  eventId: string;
  eventCode: string;
  title: string;
  start: string | null;
  end: string | null;
  attendees: Array<{
    studentId: string;
    studentName: string | null;
    scannedAt: string;
    status: AttendanceStatus;
  }>;
};

export type TeacherEventSummary = {
  eventId: string;
  eventCode: string;
  title: string;
  attendeeCount: number;
};

export type SystemAttendanceRecord = {
  id: string;
  studentId: string;
  studentName: string | null;
  studentEmail: string | null;
  eventId: string;
  eventTitle: string;
  eventCode: string;
  scannedAt: string;
  status: AttendanceStatus;
};

export async function registerAttendance(rawPayload: string): Promise<RegisterResult> {
  const parsed = parseQRPayload(rawPayload);
  if (!parsed.ok) return { success: false, message: parsed.message };
  const payload = parsed.payload;

  if (!payload.start || !payload.end) {
    return { success: false, message: 'Invalid QR code.' };
  }

  const startTime = new Date(payload.start).getTime();
  const endTime = new Date(payload.end).getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
    return { success: false, message: 'Invalid date format.' };
  }

  const now = Date.now();
  if (now < startTime) return { success: false, message: 'Event has not started yet.' };
  if (now > endTime) return { success: false, message: 'Event has already ended.' };

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return { success: false, message: 'You must be signed in.' };
  }

  let event = await getEventByCode(payload.event);
  if (!event) return { success: false, message: 'Event not found. Ask the teacher to create a new QR code.' };
  if (event.status === 'closed') {
    return { success: false, message: 'This event is closed. Attendance is no longer accepted.' };
  }

  // Arrivals more than 15 minutes after the start time are marked late.
  const status: AttendanceStatus = now > startTime + 15 * 60 * 1000 ? 'late' : 'present';

  const { error } = await supabase.from('attendance').insert({
    student_id: authData.user.id,
    event_id: event.id,
    status,
  });

  if (error?.code === '23505') {
    return { success: false, message: 'Already registered for this event.' };
  }
  if (error?.code === '42501' || error?.message?.toLowerCase().includes('row-level security')) {
    return {
      success: false,
      message: 'Attendance was blocked. Make sure the event is open and you are signed in with a student account.',
    };
  }
  if (error) {
    return { success: false, message: `Could not record attendance: ${error.message}` };
  }

  return {
    success: true,
    message:
      status === 'late'
        ? 'Attendance recorded (late).'
        : 'Attendance recorded!',
    eventTitle: event.title,
  };
}

export async function getAttendanceHistory(studentId: string): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('id, scanned_at, status, event_id, events ( title )')
    .eq('student_id', studentId)
    .order('scanned_at', { ascending: false });
  if (error) return [];

  return (data ?? []).map((row: any) => ({
    id: row.id,
    eventId: row.event_id,
    eventTitle: Array.isArray(row.events) ? row.events[0]?.title : row.events?.title,
    scannedAt: row.scanned_at,
    status: (row.status ?? 'present') as AttendanceStatus,
  }));
}

export async function getTeacherEventAttendance(
  teacherId: string
): Promise<TeacherEventAttendance[]> {
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('id, event_code, title, start_time, end_time')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });
  if (eventsError || !events?.length) return [];

  const eventIds = events.map((event) => event.id);
  const { data: attendance, error: attendanceError } = await supabase
    .from('attendance')
    .select('student_id, scanned_at, status, event_id')
    .in('event_id', eventIds)
    .order('scanned_at', { ascending: false });
  if (attendanceError) return [];

  const studentIds = [...new Set((attendance ?? []).map((row) => row.student_id))];
  const { data: profiles } = studentIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', studentIds)
    : { data: [] as Array<{ id: string; full_name: string | null }> };
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));

  return events.map((event) => ({
    eventId: event.id,
    eventCode: event.event_code,
    title: event.title,
    start: event.start_time,
    end: event.end_time,
    attendees: (attendance ?? [])
      .filter((row) => row.event_id === event.id)
      .map((row) => ({
        studentId: row.student_id,
        studentName: names.get(row.student_id) ?? null,
        scannedAt: row.scanned_at,
        status: (row.status ?? 'present') as AttendanceStatus,
      })),
  }));
}

export async function getTeacherEventSummary(
  teacherId: string
): Promise<TeacherEventSummary[]> {
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('id, event_code, title')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });
  if (eventsError || !events?.length) return [];

  const eventIds = events.map((event) => event.id);
  const { data: rows, error } = await supabase
    .from('attendance')
    .select('event_id')
    .in('event_id', eventIds);
  if (error) return [];

  const counts: Record<string, number> = {};
  (rows ?? []).forEach((row) => {
    counts[row.event_id] = (counts[row.event_id] ?? 0) + 1;
  });

  return events.map((event) => ({
    eventId: event.id,
    eventCode: event.event_code,
    title: event.title,
    attendeeCount: counts[event.id] ?? 0,
  }));
}

// ------------------------------------------------------------
// Administrator: view every attendance record in the system
// ------------------------------------------------------------

export async function getAllAttendance(): Promise<SystemAttendanceRecord[]> {
  const { data: attendance, error } = await supabase
    .from('attendance')
    .select('id, student_id, event_id, scanned_at, status, events ( id, title, event_code )')
    .order('scanned_at', { ascending: false });
  if (error || !attendance?.length) return [];

  const studentIds = [...new Set(attendance.map((row: any) => row.student_id as string))];
  const { data: profiles } = studentIds.length
    ? await supabase.from('profiles').select('id, full_name, email').in('id', studentIds)
    : { data: [] as Array<{ id: string; full_name: string | null; email: string | null }> };
  const info = new Map((profiles ?? []).map((p) => [p.id, p]));

  return (attendance as any[]).map((row) => {
    const event = Array.isArray(row.events) ? row.events[0] : row.events;
    const profile = info.get(row.student_id);
    return {
      id: row.id,
      studentId: row.student_id,
      studentName: profile?.full_name ?? null,
      studentEmail: profile?.email ?? null,
      eventId: row.event_id,
      eventTitle: event?.title ?? 'Unknown event',
      eventCode: event?.event_code ?? '',
      scannedAt: row.scanned_at,
      status: (row.status ?? 'present') as AttendanceStatus,
    };
  });
}

// Administrator: correct or remove a record (data validation / correction)
export async function updateAttendanceStatus(id: string, status: AttendanceStatus) {
  return supabase.from('attendance').update({ status }).eq('id', id);
}

export async function deleteAttendance(id: string) {
  return supabase.from('attendance').delete().eq('id', id);
}

// ------------------------------------------------------------
// Realtime: subscribe to attendance changes (live updates)
// Returns an unsubscribe function.
// ------------------------------------------------------------

export function subscribeToAttendance(onChange: () => void): () => void {
  const channel = supabase
    .channel('attendance-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'attendance' },
      () => onChange()
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

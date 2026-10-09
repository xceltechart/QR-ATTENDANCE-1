import { supabase } from './supabase';

export type EventStatus = 'open' | 'closed';

export type Event = {
  eventId: string;
  title: string;
  start: string;
  end: string;
  venue?: string;
  description?: string;
};

export type CloudEvent = {
  id: string;
  event_code: string;
  title: string;
  venue: string | null;
  description: string | null;
  status: EventStatus;
  start_time: string | null;
  end_time: string | null;
  created_by?: string | null;
  created_at?: string;
};

export async function createEvent(event: Event) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return { data: null, error: authError ?? new Error('You must be signed in.') };
  }

  const { data, error } = await supabase
    .from('events')
    .insert({
      event_code: event.eventId,
      title: event.title,
      venue: event.venue?.trim() || null,
      description: event.description?.trim() || null,
      status: 'open',
      start_time: event.start,
      end_time: event.end,
      created_by: authData.user.id,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      return {
        data: null,
        error: new Error('That event code already exists. Use a unique code.'),
      };
    }
    return { data, error: new Error(describeEventError(error.message)) };
  }

  return { data, error };
}

export async function updateEvent(id: string, event: Event) {
  const { data, error } = await supabase
    .from('events')
    .update({
      event_code: event.eventId,
      title: event.title,
      venue: event.venue?.trim() || null,
      description: event.description?.trim() || null,
      start_time: event.start,
      end_time: event.end,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      return {
        data: null,
        error: new Error('That event code already exists. Use a unique code.'),
      };
    }
    return { data, error: new Error(describeEventError(error.message)) };
  }

  return { data, error };
}

export async function setEventStatus(id: string, status: EventStatus) {
  const { data, error } = await supabase
    .from('events')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single();
  if (error) return { data: null, error: new Error(describeEventError(error.message)) };
  return { data, error };
}

function describeEventError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('row-level security') || lower.includes('permission denied')) {
    return 'The database blocked this action. Your account must have the Teacher or Admin role — ask an administrator to upgrade your account.';
  }
  if (lower.includes('does not exist') || lower.includes('relation')) {
    return 'A required table/column is missing. Open your Supabase dashboard, run supabase/schema.sql in the SQL Editor, and try again.';
  }
  return message;
}

export async function getEventsByTeacher(teacherId: string): Promise<CloudEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });
  return error ? [] : ((data ?? []) as CloudEvent[]);
}

export async function getAllEvents(): Promise<CloudEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false });
  return error ? [] : ((data ?? []) as CloudEvent[]);
}

export async function getAvailableEvents(): Promise<CloudEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'open')
    .order('start_time', { ascending: true });
  return error ? [] : ((data ?? []) as CloudEvent[]);
}

export async function getEventByCode(code: string): Promise<CloudEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('event_code', code)
    .maybeSingle();
  return error ? null : (data as CloudEvent | null);
}

// Realtime: notify when events change (created / edited / closed).
// Returns an unsubscribe function.
export function subscribeToEvents(onChange: () => void): () => void {
  const channel = supabase
    .channel('events-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'events' },
      () => onChange()
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

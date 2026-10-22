-- Fix recursive row-level security policies that prevent students from
-- recording attendance. Safe to run in the Supabase SQL Editor.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.has_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = required_role
  );
$$;

revoke all on function public.has_role(text) from public, anon;
grant execute on function public.has_role(text) to authenticated;

create or replace function public.can_view_attendee_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('teacher') and exists (
    select 1
    from public.attendance a
    join public.events e on e.id = a.event_id
    where a.student_id = target_profile_id and e.created_by = auth.uid()
  );
$$;

revoke all on function public.can_view_attendee_profile(uuid) from public, anon;
grant execute on function public.can_view_attendee_profile(uuid) to authenticated;

drop policy if exists "Teachers can view profiles of their attendees" on public.profiles;
create policy "Teachers can view profiles of their attendees" on public.profiles
  for select using (public.can_view_attendee_profile(id));

drop policy if exists "Users can insert events" on public.events;
drop policy if exists "Teachers and admins can insert events" on public.events;
create policy "Teachers and admins can insert events" on public.events
  for insert with check (
    auth.uid() = created_by
    and (public.has_role('teacher') or public.is_admin())
  );

drop policy if exists "Users can update their own events" on public.events;
drop policy if exists "Owners and admins can update events" on public.events;
create policy "Owners and admins can update events" on public.events
  for update using (
    (auth.uid() = created_by and public.has_role('teacher'))
    or public.is_admin()
  )
  with check (
    (auth.uid() = created_by and public.has_role('teacher'))
    or public.is_admin()
  );

drop policy if exists "Owners and admins can delete events" on public.events;
create policy "Owners and admins can delete events" on public.events
  for delete using (
    (auth.uid() = created_by and public.has_role('teacher'))
    or public.is_admin()
  );

drop policy if exists "Students can insert their own attendance" on public.attendance;
create policy "Students can insert their own attendance" on public.attendance
  for insert with check (
    auth.uid() = student_id
    and public.has_role('student')
    and exists (
      select 1 from public.events e
      where e.id = event_id and e.status = 'open'
    )
  );

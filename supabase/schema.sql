-- QR Attendance — Supabase schema
-- Safe to re-run (idempotent). Run this whole file in the Supabase SQL Editor.

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  event_code text not null unique,
  title text not null,
  venue text,
  description text,
  status text not null default 'open',
  start_time timestamptz,
  end_time timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  status text not null default 'present',
  scanned_at timestamptz not null default now(),
  unique (student_id, event_id)
);

-- Upgrade path for databases created with the original schema
alter table public.profiles
  drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('student', 'teacher', 'admin'));

alter table public.events add column if not exists venue text;
alter table public.events add column if not exists description text;
alter table public.events add column if not exists status text not null default 'open';
alter table public.events
  drop constraint if exists events_status_check;
alter table public.events
  add constraint events_status_check check (status in ('open', 'closed'));

alter table public.attendance add column if not exists status text not null default 'present';
alter table public.attendance
  drop constraint if exists attendance_status_check;
alter table public.attendance
  add constraint attendance_status_check check (status in ('present', 'late', 'absent'));

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.attendance enable row level security;

-- Helper: is the current user an administrator? (security definer so it can
-- read profiles without recursing through the profiles policies)
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

-- ------------------------------------------------------------
-- profiles policies
-- ------------------------------------------------------------

drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile" on public.profiles
  for insert with check (auth.uid() = id and role in ('student', 'teacher'));

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Teachers can view profiles of their attendees" on public.profiles;
create policy "Teachers can view profiles of their attendees" on public.profiles
  for select using (public.can_view_attendee_profile(id));

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles" on public.profiles
  for select using (public.is_admin());

drop policy if exists "Admins can update all profiles" on public.profiles;
create policy "Admins can update all profiles" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- Role changes are only allowed for administrators (an account can never
-- grant itself a higher role). Direct database access (SQL editor /
-- service role, where auth.uid() is null) is always allowed.
create or replace function public.protect_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() is null then
      return new; -- SQL editor / service role
    end if;
    if auth.uid() = new.id and not public.is_admin() then
      raise exception 'Your account cannot change its own role. Ask an administrator.';
    end if;
    if not public.is_admin() then
      raise exception 'Only an administrator can change account roles.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_role_change on public.profiles;
create trigger protect_role_change
  before update on public.profiles
  for each row execute function public.protect_role_change();


-- ------------------------------------------------------------
-- events policies
-- ------------------------------------------------------------

drop policy if exists "Events are readable by any authenticated user" on public.events;
create policy "Events are readable by any authenticated user" on public.events
  for select using (auth.role() = 'authenticated');

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

-- ------------------------------------------------------------
-- attendance policies
-- ------------------------------------------------------------

drop policy if exists "Students can view their own attendance" on public.attendance;
create policy "Students can view their own attendance" on public.attendance
  for select using (auth.uid() = student_id);

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

drop policy if exists "Teachers can view attendance for their events" on public.attendance;
create policy "Teachers can view attendance for their events" on public.attendance
  for select using (
    exists (
      select 1 from public.events e
      where e.id = attendance.event_id and e.created_by = auth.uid()
    )
  );

drop policy if exists "Admins can view all attendance" on public.attendance;
create policy "Admins can view all attendance" on public.attendance
  for select using (public.is_admin());

drop policy if exists "Admins can update attendance" on public.attendance;
create policy "Admins can update attendance" on public.attendance
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can delete attendance" on public.attendance;
create policy "Admins can delete attendance" on public.attendance
  for delete using (public.is_admin());

-- ============================================================
-- AUTH TRIGGERS
-- ============================================================

-- New signups always start as students; the designated administrator email
-- becomes an admin. Roles are otherwise only granted by an admin in the app.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    case
      when lower(new.email) = 'axceldreyes100+admin@gmail.com'
        then 'admin'
      else 'student'
    end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- REALTIME (live attendance / event updates)
-- ============================================================

do $$
begin
  alter publication supabase_realtime add table public.attendance;
exception when duplicate_object then null; when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.events;
exception when duplicate_object then null; when undefined_object then null;
end $$;

-- ============================================================
-- BOOTSTRAP ADMINISTRATOR ACCOUNT
-- The account is created by signing up in the app with the admin email;
-- this line grants the admin role to it (run after the account exists, and
-- re-run any time — it is safe to repeat).
-- ============================================================

update public.profiles
  set role = 'admin', updated_at = now()
  where lower(email) = lower('axceldreyes100+admin@gmail.com');

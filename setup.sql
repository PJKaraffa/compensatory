-- This script matches the Version 2 application exactly.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('administrator','provider')),
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id bigint generated always as identity primary key,
  student_id text not null unique,
  first_name text not null,
  last_name text not null,
  school text not null,
  grade text not null,
  comp_hours numeric(8,2) not null default 0 check (comp_hours >= 0),
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.service_sessions (
  id bigint generated always as identity primary key,
  student_id bigint not null references public.students(id) on delete cascade,
  provider_id uuid not null references public.profiles(id),
  service_date date not null,
  start_time time not null,
  end_time time not null,
  hours numeric(8,2) not null check (hours > 0),
  notes text,
  created_at timestamptz not null default now(),
  constraint valid_service_time check (end_time > start_time)
);

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

grant execute on function public.current_user_role() to authenticated;

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.service_sessions enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles
for select to authenticated using (id = auth.uid());

drop policy if exists "Administrators read all profiles" on public.profiles;
create policy "Administrators read all profiles" on public.profiles
for select to authenticated using (public.current_user_role() = 'administrator');

drop policy if exists "Authenticated users read students" on public.students;
create policy "Authenticated users read students" on public.students
for select to authenticated using (active = true);

drop policy if exists "Administrators insert students" on public.students;
create policy "Administrators insert students" on public.students
for insert to authenticated with check (public.current_user_role() = 'administrator');

drop policy if exists "Administrators update students" on public.students;
create policy "Administrators update students" on public.students
for update to authenticated
using (public.current_user_role() = 'administrator')
with check (public.current_user_role() = 'administrator');

drop policy if exists "Administrators delete students" on public.students;
create policy "Administrators delete students" on public.students
for delete to authenticated using (public.current_user_role() = 'administrator');

drop policy if exists "Administrators read all sessions" on public.service_sessions;
create policy "Administrators read all sessions" on public.service_sessions
for select to authenticated using (public.current_user_role() = 'administrator');

drop policy if exists "Providers read own sessions" on public.service_sessions;
create policy "Providers read own sessions" on public.service_sessions
for select to authenticated using (provider_id = auth.uid());

drop policy if exists "Users insert own sessions" on public.service_sessions;
create policy "Users insert own sessions" on public.service_sessions
for insert to authenticated
with check (
  provider_id = auth.uid()
  and public.current_user_role() in ('administrator','provider')
);

drop policy if exists "Administrators delete all sessions" on public.service_sessions;
create policy "Administrators delete all sessions" on public.service_sessions
for delete to authenticated using (public.current_user_role() = 'administrator');

drop policy if exists "Providers delete own sessions" on public.service_sessions;
create policy "Providers delete own sessions" on public.service_sessions
for delete to authenticated using (provider_id = auth.uid());

notify pgrst, 'reload schema';


-- =========================================================
-- PROVIDER ASSIGNMENT + STUDENT CSV IMPORT MIGRATION
-- Run once in the Supabase SQL Editor.
-- =========================================================

-- Store provider email so the CSV importer can match providers.
alter table public.profiles
add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and (
    p.email is null
    or p.email <> u.email
  );

create unique index if not exists profiles_email_unique
on public.profiles (lower(email))
where email is not null;

-- Assign exactly one provider to each student.
alter table public.students
add column if not exists assigned_provider_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'students_assigned_provider_id_fkey'
  ) then
    alter table public.students
    add constraint students_assigned_provider_id_fkey
    foreign key (assigned_provider_id)
    references public.profiles(id);
  end if;
end
$$;

create index if not exists idx_students_assigned_provider
on public.students(assigned_provider_id);

-- Administrators can read every profile.
-- Providers can read their own profile.
alter table public.profiles enable row level security;

drop policy if exists "Users read own profile"
on public.profiles;

create policy "Users read own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "Administrators read all profiles"
on public.profiles;

create policy "Administrators read all profiles"
on public.profiles
for select
to authenticated
using (public.current_user_role() = 'administrator');

grant select on public.profiles to authenticated;

-- Students are visible only to administrators or the assigned provider.
alter table public.students enable row level security;

drop policy if exists "Authenticated users read students"
on public.students;

drop policy if exists "Authenticated users read active students"
on public.students;

create policy "Administrators read all active students"
on public.students
for select
to authenticated
using (
  active = true
  and public.current_user_role() = 'administrator'
);

create policy "Providers read assigned active students"
on public.students
for select
to authenticated
using (
  active = true
  and assigned_provider_id = auth.uid()
);

drop policy if exists "Administrators insert students"
on public.students;

create policy "Administrators insert students"
on public.students
for insert
to authenticated
with check (
  public.current_user_role() = 'administrator'
);

drop policy if exists "Administrators update students"
on public.students;

create policy "Administrators update students"
on public.students
for update
to authenticated
using (
  public.current_user_role() = 'administrator'
)
with check (
  public.current_user_role() = 'administrator'
);

-- Providers may insert a service only for a student assigned to them.
alter table public.service_sessions enable row level security;

drop policy if exists "Authenticated users insert own sessions"
on public.service_sessions;

drop policy if exists "Users insert own sessions"
on public.service_sessions;

drop policy if exists "Users insert own service sessions"
on public.service_sessions;

create policy "Providers insert sessions for assigned students"
on public.service_sessions
for insert
to authenticated
with check (
  provider_id = auth.uid()
  and exists (
    select 1
    from public.students s
    where s.id = service_sessions.student_id
      and s.assigned_provider_id = auth.uid()
      and s.active = true
  )
);

create policy "Administrators insert sessions"
on public.service_sessions
for insert
to authenticated
with check (
  provider_id = auth.uid()
  and public.current_user_role() = 'administrator'
);

-- Secure totals:
-- administrators receive all active students;
-- providers receive only students assigned to them.
create or replace function public.get_student_hour_totals()
returns table
(
  student_id bigint,
  completed_hours numeric,
  hours_left numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id as student_id,

    coalesce(
      sum(ss.hours),
      0
    )::numeric(8,2) as completed_hours,

    greatest(
      s.comp_hours -
      coalesce(sum(ss.hours), 0),
      0
    )::numeric(8,2) as hours_left

  from public.students s

  left join public.service_sessions ss
    on ss.student_id = s.id

  where
    s.active = true
    and (
      public.current_user_role() = 'administrator'
      or s.assigned_provider_id = auth.uid()
    )

  group by
    s.id,
    s.comp_hours
$$;

grant execute
on function public.get_student_hour_totals()
to authenticated;

grant insert, update, select
on public.students
to authenticated;

grant insert, select, delete
on public.service_sessions
to authenticated;

notify pgrst, 'reload schema';



-- =========================================================
-- REQUIRED SERVICE NOTES
-- Run once in the Supabase SQL Editor.
-- =========================================================

-- Existing blank/null notes are preserved with a clear legacy label
-- so the NOT NULL constraint can be enabled safely.
update public.service_sessions
set notes = 'Legacy service entry — notes were not recorded.'
where notes is null
   or btrim(notes) = '';

alter table public.service_sessions
alter column notes set not null;

alter table public.service_sessions
drop constraint if exists service_sessions_notes_not_blank;

alter table public.service_sessions
add constraint service_sessions_notes_not_blank
check (btrim(notes) <> '');

notify pgrst, 'reload schema';

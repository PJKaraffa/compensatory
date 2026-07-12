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

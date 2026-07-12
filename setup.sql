create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('administrator', 'provider')),
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  student_number text not null unique,
  student_name text not null,
  school text not null,
  grade text not null,
  comp_hours numeric(8,2) not null default 0 check (comp_hours >= 0),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

create table if not exists public.service_entries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
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
  select role
  from public.profiles
  where id = auth.uid()
$$;

grant execute on function public.current_user_role() to authenticated;

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.service_entries enable row level security;

drop policy if exists "Users can read profiles" on public.profiles;
create policy "Users can read profiles"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "Administrators manage profiles" on public.profiles;
create policy "Administrators manage profiles"
on public.profiles
for all
to authenticated
using (public.current_user_role() = 'administrator')
with check (public.current_user_role() = 'administrator');

drop policy if exists "Authenticated users read students" on public.students;
create policy "Authenticated users read students"
on public.students
for select
to authenticated
using (true);

drop policy if exists "Administrators insert students" on public.students;
create policy "Administrators insert students"
on public.students
for insert
to authenticated
with check (public.current_user_role() = 'administrator');

drop policy if exists "Administrators update students" on public.students;
create policy "Administrators update students"
on public.students
for update
to authenticated
using (public.current_user_role() = 'administrator')
with check (public.current_user_role() = 'administrator');

drop policy if exists "Administrators delete students" on public.students;
create policy "Administrators delete students"
on public.students
for delete
to authenticated
using (public.current_user_role() = 'administrator');

drop policy if exists "Read permitted service entries" on public.service_entries;
create policy "Read permitted service entries"
on public.service_entries
for select
to authenticated
using (
  public.current_user_role() = 'administrator'
  or provider_id = auth.uid()
);

drop policy if exists "Users insert own service entries" on public.service_entries;
create policy "Users insert own service entries"
on public.service_entries
for insert
to authenticated
with check (
  provider_id = auth.uid()
  and public.current_user_role() in ('administrator', 'provider')
);

drop policy if exists "Users delete permitted service entries" on public.service_entries;
create policy "Users delete permitted service entries"
on public.service_entries
for delete
to authenticated
using (
  public.current_user_role() = 'administrator'
  or provider_id = auth.uid()
);

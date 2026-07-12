-- CLEAN REBUILD: this drops and recreates the three application tables.
create extension if not exists pgcrypto;

drop view if exists public.student_comp_summary cascade;
drop table if exists public.service_sessions cascade;
drop table if exists public.students cascade;
drop table if exists public.profiles cascade;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('administrator', 'provider')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
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

create table public.service_sessions (
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

create index idx_students_last_first on public.students(last_name, first_name);
create index idx_students_school on public.students(school);
create index idx_service_sessions_student on public.service_sessions(student_id);
create index idx_service_sessions_provider on public.service_sessions(provider_id);
create index idx_service_sessions_date on public.service_sessions(service_date);

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and active = true
$$;

grant execute on function public.current_user_role() to authenticated;

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.service_sessions enable row level security;

create policy "Users read own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "Administrators read all profiles" on public.profiles for select to authenticated using (public.current_user_role() = 'administrator');
create policy "Administrators insert profiles" on public.profiles for insert to authenticated with check (public.current_user_role() = 'administrator');
create policy "Administrators update profiles" on public.profiles for update to authenticated using (public.current_user_role() = 'administrator') with check (public.current_user_role() = 'administrator');

create policy "Authenticated users read active students" on public.students for select to authenticated using (active = true);
create policy "Administrators insert students" on public.students for insert to authenticated with check (public.current_user_role() = 'administrator');
create policy "Administrators update students" on public.students for update to authenticated using (public.current_user_role() = 'administrator') with check (public.current_user_role() = 'administrator');
create policy "Administrators delete students" on public.students for delete to authenticated using (public.current_user_role() = 'administrator');

create policy "Administrators read all service sessions" on public.service_sessions for select to authenticated using (public.current_user_role() = 'administrator');
create policy "Providers read own service sessions" on public.service_sessions for select to authenticated using (provider_id = auth.uid());
create policy "Users insert own service sessions" on public.service_sessions for insert to authenticated with check (provider_id = auth.uid() and public.current_user_role() in ('administrator','provider'));
create policy "Administrators update all service sessions" on public.service_sessions for update to authenticated using (public.current_user_role() = 'administrator') with check (public.current_user_role() = 'administrator');
create policy "Providers update own service sessions" on public.service_sessions for update to authenticated using (provider_id = auth.uid()) with check (provider_id = auth.uid());
create policy "Administrators delete all service sessions" on public.service_sessions for delete to authenticated using (public.current_user_role() = 'administrator');
create policy "Providers delete own service sessions" on public.service_sessions for delete to authenticated using (provider_id = auth.uid());

create view public.student_comp_summary with (security_invoker = true) as
select
  s.id, s.student_id, s.first_name, s.last_name, s.school, s.grade, s.comp_hours,
  coalesce(sum(ss.hours),0)::numeric(8,2) as completed_hours,
  greatest(s.comp_hours - coalesce(sum(ss.hours),0),0)::numeric(8,2) as hours_left
from public.students s
left join public.service_sessions ss on ss.student_id = s.id
where s.active = true
group by s.id, s.student_id, s.first_name, s.last_name, s.school, s.grade, s.comp_hours;

grant select on public.student_comp_summary to authenticated;

-- After creating users in Authentication, insert profiles like this:
-- insert into public.profiles (id, full_name, role)
-- values ('AUTH-USER-UUID', 'PJ Karaffa', 'administrator');
--
-- insert into public.profiles (id, full_name, role)
-- values ('AUTH-USER-UUID', 'Provider Name', 'provider');

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

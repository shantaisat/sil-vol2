-- ============================================================================
-- SILVOL database schema (stages 1-6)
--
-- Run this whole file once in the Supabase dashboard: SQL Editor -> New query.
--
-- Roles
--   org_admin  runs an organisation, invites teachers
--   teacher    belongs to an organisation, invites and manages students
--   student    belongs to one teacher (or is an unassigned independent learner)
--
-- Who can see what is enforced HERE (row-level security), not in the browser.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------
create table public.organisations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) between 1 and 120),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  email            text not null,
  full_name        text not null default '' check (char_length(full_name) <= 120),
  role             text not null default 'student'
                   check (role in ('org_admin', 'teacher', 'student')),
  organisation_id  uuid references public.organisations (id) on delete set null,
  teacher_id       uuid,
  phone            text check (char_length(phone) <= 40),
  location         text check (char_length(location) <= 120),
  about            text check (char_length(about) <= 1000),
  created_at       timestamptz not null default now(),

  constraint profiles_teacher_id_fkey
    foreign key (teacher_id) references public.profiles (id) on delete set null,
  -- only students have a teacher
  constraint profiles_teacher_only_for_students
    check (role = 'student' or teacher_id is null)
);

create index profiles_organisation_id_idx on public.profiles (organisation_id);
create index profiles_teacher_id_idx      on public.profiles (teacher_id);

-- An invite reserves an email address for a role. When that person signs up with
-- the same email, the new-user trigger below gives them the invited role.
create table public.invites (
  id               uuid primary key default gen_random_uuid(),
  email            text not null,
  role             text not null check (role in ('teacher', 'student')),
  organisation_id  uuid not null references public.organisations (id) on delete cascade,
  teacher_id       uuid references public.profiles (id) on delete cascade,
  invited_by       uuid not null references public.profiles (id) on delete cascade,
  status           text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at       timestamptz not null default now(),
  accepted_at      timestamptz,

  -- student invites name a teacher; teacher invites do not
  constraint invites_teacher_matches_role
    check ((role = 'student' and teacher_id is not null)
        or (role = 'teacher' and teacher_id is null))
);

create unique index invites_one_pending_per_email
  on public.invites (lower(email)) where status = 'pending';
create index invites_organisation_id_idx on public.invites (organisation_id);
create index invites_invited_by_idx      on public.invites (invited_by);

-- ----------------------------------------------------------------------------
-- Helper functions used by the security policies
-- (security definer = they read profiles without triggering the policies again)
-- ----------------------------------------------------------------------------
create or replace function public.auth_role()
returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.auth_org()
returns uuid
language sql stable security definer set search_path = public as $$
  select organisation_id from public.profiles where id = auth.uid()
$$;

create or replace function public.auth_teacher()
returns uuid
language sql stable security definer set search_path = public as $$
  select teacher_id from public.profiles where id = auth.uid()
$$;

revoke execute on function public.auth_role(), public.auth_org(), public.auth_teacher()
  from public, anon;
grant execute on function public.auth_role(), public.auth_org(), public.auth_teacher()
  to authenticated;

-- ----------------------------------------------------------------------------
-- New user -> profile
--
-- The role is decided HERE, never by the browser:
--   * "organisation" sign-up  -> new organisation + org_admin
--   * email has a pending invite -> the invited role, organisation and teacher
--   * anyone else -> an unassigned student
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta       jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  display    text  := coalesce(nullif(trim(meta ->> 'full_name'), ''), split_part(new.email, '@', 1));
  org_name   text  := nullif(trim(meta ->> 'organisation_name'), '');
  new_org_id uuid;
  inv        public.invites%rowtype;
begin
  display := left(display, 120);

  if meta ->> 'account_type' = 'organisation' then
    insert into public.organisations (name, created_by)
    values (left(coalesce(org_name, display || '''s organisation'), 120), new.id)
    returning id into new_org_id;

    insert into public.profiles (id, email, full_name, role, organisation_id)
    values (new.id, new.email, display, 'org_admin', new_org_id);

    return new;
  end if;

  select * into inv
  from public.invites
  where lower(email) = lower(new.email) and status = 'pending'
  order by created_at
  limit 1;

  if found then
    insert into public.profiles (id, email, full_name, role, organisation_id, teacher_id)
    values (new.id, new.email, display, inv.role, inv.organisation_id, inv.teacher_id);

    update public.invites
    set status = 'accepted', accepted_at = now()
    where id = inv.id;
  else
    insert into public.profiles (id, email, full_name, role)
    values (new.id, new.email, display, 'student');
  end if;

  return new;
end
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Invite checks: tidy the email and refuse emails that already have an account
-- ----------------------------------------------------------------------------
create or replace function public.check_invite()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.email := lower(trim(new.email));

  if new.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email address.';
  end if;

  if exists (select 1 from public.profiles where lower(email) = new.email) then
    raise exception 'That email address already has a SILVOL account.';
  end if;

  return new;
end
$$;

revoke execute on function public.check_invite() from public, anon, authenticated;

create trigger invites_check
  before insert on public.invites
  for each row execute function public.check_invite();

-- ----------------------------------------------------------------------------
-- Table privileges
-- Signed-out visitors get nothing. Signed-in users can only update the editable
-- profile fields; role / organisation / teacher can never be changed from the browser.
-- ----------------------------------------------------------------------------
revoke all on public.organisations, public.profiles, public.invites from anon;

revoke insert, update, delete on public.organisations from authenticated;

revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name, phone, location, about) on public.profiles to authenticated;

revoke update on public.invites from authenticated;

-- ----------------------------------------------------------------------------
-- Row-level security
-- ----------------------------------------------------------------------------
alter table public.organisations enable row level security;
alter table public.profiles      enable row level security;
alter table public.invites       enable row level security;

-- organisations: you can see your own
create policy "members read their organisation"
  on public.organisations for select to authenticated
  using (id = public.auth_org());

-- profiles
create policy "read own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "org admins read everyone in their organisation"
  on public.profiles for select to authenticated
  using (public.auth_role() = 'org_admin' and organisation_id = public.auth_org());

create policy "teachers read their students"
  on public.profiles for select to authenticated
  using (public.auth_role() = 'teacher' and teacher_id = auth.uid());

create policy "students read their teacher"
  on public.profiles for select to authenticated
  using (id = public.auth_teacher());

create policy "update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- invites
create policy "org admins read invites in their organisation"
  on public.invites for select to authenticated
  using (public.auth_role() = 'org_admin' and organisation_id = public.auth_org());

create policy "read invites you sent"
  on public.invites for select to authenticated
  using (invited_by = auth.uid());

create policy "org admins invite teachers"
  on public.invites for insert to authenticated
  with check (
    public.auth_role() = 'org_admin'
    and role = 'teacher'
    and organisation_id = public.auth_org()
    and invited_by = auth.uid()
    and status = 'pending'
  );

create policy "teachers invite their own students"
  on public.invites for insert to authenticated
  with check (
    public.auth_role() = 'teacher'
    and role = 'student'
    and organisation_id = public.auth_org()
    and teacher_id = auth.uid()
    and invited_by = auth.uid()
    and status = 'pending'
  );

create policy "withdraw pending invites"
  on public.invites for delete to authenticated
  using (
    status = 'pending'
    and (
      invited_by = auth.uid()
      or (public.auth_role() = 'org_admin' and organisation_id = public.auth_org())
    )
  );

-- ----------------------------------------------------------------------------
-- Make the API pick up the new tables straight away
-- ----------------------------------------------------------------------------
notify pgrst, 'reload schema';

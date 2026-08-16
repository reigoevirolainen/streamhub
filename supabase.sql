-- ============================================================
-- STREAMHUB V30 STABLE
-- Run this entire file in Supabase SQL Editor -> New query.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------------- PROFILES ----------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  user_type text not null default 'streamer',
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists user_type text default 'streamer';
alter table public.profiles add column if not exists created_at timestamptz default now();

update public.profiles set user_type='streamer' where user_type is null;
update public.profiles set created_at=now() where created_at is null;

-- ---------------- STREAMERS ----------------
create table if not exists public.streamers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  platform text not null,
  channel_url text not null,
  game text,
  avatar_url text,
  thumbnail_url text,
  live_video_id text,
  is_live boolean not null default false,
  viewers integer not null default 0,
  manual_live boolean not null default false,
  manual_viewers integer not null default 0,
  owner_id uuid references auth.users(id) on delete set null,
  owner_email text,
  last_checked_at timestamptz,
  last_live_at timestamptz,
  sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.streamers add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.streamers add column if not exists owner_email text;
alter table public.streamers add column if not exists game text;
alter table public.streamers add column if not exists avatar_url text;
alter table public.streamers add column if not exists thumbnail_url text;
alter table public.streamers add column if not exists live_video_id text;
alter table public.streamers add column if not exists is_live boolean default false;
alter table public.streamers add column if not exists viewers integer default 0;
alter table public.streamers add column if not exists manual_live boolean default false;
alter table public.streamers add column if not exists manual_viewers integer default 0;
alter table public.streamers add column if not exists owner_email text;
alter table public.streamers add column if not exists last_checked_at timestamptz;
alter table public.streamers add column if not exists last_live_at timestamptz;
alter table public.streamers add column if not exists sync_error text;
alter table public.streamers add column if not exists created_at timestamptz default now();
alter table public.streamers add column if not exists updated_at timestamptz default now();

update public.streamers set is_live=false where is_live is null;
update public.streamers set viewers=0 where viewers is null;
update public.streamers set manual_live=false where manual_live is null;
update public.streamers set manual_viewers=0 where manual_viewers is null;
update public.streamers set created_at=now() where created_at is null;
update public.streamers set updated_at=now() where updated_at is null;

-- ---------------- APPLICATIONS ----------------
create table if not exists public.streamer_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  platform text not null,
  channel_url text not null,
  game text,
  avatar_url text,
  message text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id)
);

alter table public.streamer_applications add column if not exists name text;
alter table public.streamer_applications add column if not exists email text;
alter table public.streamer_applications add column if not exists platform text;
alter table public.streamer_applications add column if not exists channel_url text;
alter table public.streamer_applications add column if not exists game text;
alter table public.streamer_applications add column if not exists avatar_url text;
alter table public.streamer_applications add column if not exists message text;
alter table public.streamer_applications add column if not exists status text default 'pending';
alter table public.streamer_applications add column if not exists created_at timestamptz default now();
alter table public.streamer_applications add column if not exists approved_at timestamptz;
alter table public.streamer_applications add column if not exists approved_by uuid;

update public.streamer_applications set status='pending' where status is null;
update public.streamer_applications set created_at=now() where created_at is null;

-- ---------------- AUTH -> PROFILE ----------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, username, user_type)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'username',''), split_part(coalesce(new.email,''),'@',1)),
    'streamer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill all existing Auth users into profiles.
insert into public.profiles(id, username, user_type)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data->>'username',''), split_part(coalesce(u.email,''),'@',1)),
  'streamer'
from auth.users u
on conflict (id) do nothing;

-- ---------------- RLS ----------------
alter table public.profiles enable row level security;
alter table public.streamers enable row level security;
alter table public.streamer_applications enable row level security;

-- Drop known old policies so they cannot conflict.
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own_username" on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

drop policy if exists "streamers_public_read" on public.streamers;
drop policy if exists "streamers_owner_update" on public.streamers;
drop policy if exists "Anyone can view streamers" on public.streamers;
drop policy if exists "Streamer can update own row" on public.streamers;

drop policy if exists "apps_public_insert" on public.streamer_applications;
drop policy if exists "Public can submit applications" on public.streamer_applications;
drop policy if exists "public submit applications" on public.streamer_applications;
drop policy if exists "apps_admin_read" on public.streamer_applications;
drop policy if exists "apps_admin_update" on public.streamer_applications;
drop policy if exists "Admins can read applications" on public.streamer_applications;
drop policy if exists "Admins can update applications" on public.streamer_applications;

-- Profiles: authenticated user reads own profile; only username can be updated.
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy "profiles_update_own_username"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Public directory read.
create policy "streamers_public_read"
on public.streamers for select
to anon, authenticated
using (true);

-- Streamer can update own row.
create policy "streamers_owner_update"
on public.streamers for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

-- Public application submission.
create policy "apps_public_insert"
on public.streamer_applications for insert
to anon, authenticated
with check (
  coalesce(status,'pending') = 'pending'
  and length(trim(name)) between 2 and 80
  and length(trim(email)) between 5 and 254
  and platform in ('Twitch','YouTube','Kick','TikTok')
  and length(trim(channel_url)) between 8 and 1000
);

-- Admin-only application read/update.
create policy "apps_admin_read"
on public.streamer_applications for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id=auth.uid() and p.user_type='admin'
  )
);

create policy "apps_admin_update"
on public.streamer_applications for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id=auth.uid() and p.user_type='admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id=auth.uid() and p.user_type='admin'
  )
);

-- ---------------- GRANTS / DATA API ----------------
grant usage on schema public to anon, authenticated;

grant select on public.streamers to anon, authenticated;
grant update on public.streamers to authenticated;

grant select on public.profiles to authenticated;
grant update(username) on public.profiles to authenticated;

grant insert on public.streamer_applications to anon, authenticated;
grant select, update on public.streamer_applications to authenticated;

-- ---------------- ADMIN BOOTSTRAP ----------------
-- The first authenticated account may become admin exactly once if no admin exists.
-- This avoids hard-coded UUIDs. After an admin exists, this function refuses.
create or replace function public.bootstrap_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_exists boolean;
  first_user uuid;
begin
  if auth.uid() is null then
    raise exception 'Login required';
  end if;

  select exists(select 1 from public.profiles where user_type='admin')
  into admin_exists;

  if admin_exists then
    return false;
  end if;

  select id into first_user
  from auth.users
  order by created_at asc
  limit 1;

  if first_user is distinct from auth.uid() then
    return false;
  end if;

  update public.profiles
  set user_type='admin'
  where id=auth.uid();

  return true;
end;
$$;

revoke all on function public.bootstrap_admin() from public, anon;
grant execute on function public.bootstrap_admin() to authenticated;

-- ---------------- APPROVAL ----------------
create or replace function public.admin_approve_streamer(p_application_id uuid)
returns public.streamer_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.streamer_applications;
  r public.streamer_applications;
begin
  if not exists (
    select 1 from public.profiles
    where id=auth.uid() and user_type='admin'
  ) then
    raise exception 'Admin access required';
  end if;

  select * into a
  from public.streamer_applications
  where id=p_application_id
  for update;

  if not found then
    raise exception 'Application not found';
  end if;

  if a.status <> 'pending' then
    raise exception 'Application is already processed';
  end if;

  insert into public.streamers(
    name,platform,channel_url,game,avatar_url,
    owner_email,is_live,viewers,created_at,updated_at
  )
  values(
    a.name,a.platform,a.channel_url,a.game,a.avatar_url,
    lower(trim(a.email)),false,0,now(),now()
  );

  update public.streamer_applications
  set status='approved',
      approved_at=now(),
      approved_by=auth.uid()
  where id=a.id
  returning * into r;

  return r;
end;
$$;

revoke all on function public.admin_approve_streamer(uuid) from public, anon, authenticated;
grant execute on function public.admin_approve_streamer(uuid) to authenticated;

-- ---------------- STREAMER CLAIM ----------------
create or replace function public.claim_my_streamer()
returns public.streamers
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.streamers;
  e text;
begin
  if auth.uid() is null then
    raise exception 'Login required';
  end if;

  select lower(trim(email)) into e
  from auth.users
  where id=auth.uid();

  update public.streamers
  set owner_id=auth.uid(), updated_at=now()
  where owner_id is null
    and owner_email is not null
    and lower(trim(owner_email))=e;

  select * into r
  from public.streamers
  where owner_id=auth.uid()
  order by created_at desc
  limit 1;

  if not found then
    return null;
  end if;

  return r;
end;
$$;

revoke all on function public.claim_my_streamer() from public, anon;
grant execute on function public.claim_my_streamer() to authenticated;

-- ---------------- POSTGREST CACHE ----------------
notify pgrst, 'reload schema';

select 'STREAMHUB V30 DATABASE READY' as status;

-- =========================================================
-- STREAMHUB V30.2 - USER + STREAMER LAYER
-- ADDITIVE migration. Keep the existing MAIN SQL unchanged.
-- Run this AFTER MAIN and after any existing STEP 2 applications SQL.
-- It is safe to run more than once.
-- =========================================================

create extension if not exists pgcrypto;
grant usage on schema public to anon, authenticated, service_role;

-- =========================================================
-- 1. USER PROFILES
-- =========================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists role text default 'user';
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();

-- Never overwrite an existing admin role.
update public.profiles set role='user' where role is null;

insert into public.profiles(id, username, role)
select u.id,
       coalesce(nullif(u.raw_user_meta_data->>'username',''), split_part(coalesce(u.email,''),'@',1)),
       'user'
from auth.users u
on conflict(id) do nothing;

create or replace function public.v302_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.profiles(id,username,role)
  values(
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'username',''), split_part(coalesce(new.email,''),'@',1)),
    'user'
  )
  on conflict(id) do nothing;
  return new;
end;
$$;

drop trigger if exists v302_auth_user_profile on auth.users;
create trigger v302_auth_user_profile
after insert on auth.users
for each row execute function public.v302_handle_new_user();

alter table public.profiles enable row level security;
drop policy if exists v302_profile_select on public.profiles;
drop policy if exists v302_profile_update on public.profiles;
create policy v302_profile_select on public.profiles
for select to authenticated using (id = auth.uid());
create policy v302_profile_update on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid() and role <> 'admin');

grant select on public.profiles to authenticated;
grant update(username) on public.profiles to authenticated;

-- =========================================================
-- 2. APPLICATIONS - extend existing table, never replace it
-- =========================================================
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
  created_at timestamptz not null default now()
);

alter table public.streamer_applications add column if not exists game text;
alter table public.streamer_applications add column if not exists avatar_url text;
alter table public.streamer_applications add column if not exists message text;
alter table public.streamer_applications add column if not exists updated_at timestamptz default now();
alter table public.streamer_applications add column if not exists approved_at timestamptz;
alter table public.streamer_applications add column if not exists approved_by uuid references auth.users(id);

-- Ensure old policies with different names cannot block the public form.
-- Only policies created by this migration are removed here.
drop policy if exists v302_apps_insert on public.streamer_applications;
drop policy if exists v302_apps_admin_select on public.streamer_applications;
drop policy if exists v302_apps_admin_update on public.streamer_applications;

alter table public.streamer_applications enable row level security;
grant insert on public.streamer_applications to anon, authenticated;
grant select, update on public.streamer_applications to authenticated;

drop policy if exists "Anyone can submit streamer application" on public.streamer_applications;
create policy v302_apps_insert on public.streamer_applications
for insert to anon, authenticated
with check (
  length(trim(name)) between 2 and 80
  and length(trim(email)) between 5 and 254
  and platform in ('Twitch','YouTube','Kick','TikTok')
  and length(trim(channel_url)) between 8 and 1000
  and coalesce(status,'pending') = 'pending'
);

-- Keep the original MAIN admin UID as the source of truth.
drop policy if exists "Admins can view applications" on public.streamer_applications;
drop policy if exists "Admins can update applications" on public.streamer_applications;
create policy v302_apps_admin_select on public.streamer_applications
for select to authenticated
using (auth.uid() = '56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);
create policy v302_apps_admin_update on public.streamer_applications
for update to authenticated
using (auth.uid() = '56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid)
with check (auth.uid() = '56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);

-- =========================================================
-- 3. STREAMER -> AUTH ACCOUNT LINK
-- =========================================================
alter table public.streamers add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.streamers add column if not exists owner_email text;
create index if not exists v302_streamers_owner_idx on public.streamers(owner_id);
create index if not exists v302_streamers_game_idx on public.streamers(lower(game));

drop policy if exists v302_streamer_owner_select on public.streamers;
drop policy if exists v302_streamer_owner_update on public.streamers;
create policy v302_streamer_owner_select on public.streamers
for select to authenticated using (owner_id = auth.uid());
create policy v302_streamer_owner_update on public.streamers
for update to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

grant select, update on public.streamers to authenticated;

-- =========================================================
-- 4. CLAIM APPROVED STREAMER BY EMAIL
-- =========================================================
create or replace function public.claim_my_streamer()
returns public.streamers
language plpgsql
security definer
set search_path=public
as $$
declare
  e text;
  r public.streamers;
begin
  if auth.uid() is null then raise exception 'Logi sisse'; end if;

  select lower(trim(email)) into e from auth.users where id=auth.uid();

  update public.streamers
  set owner_id=auth.uid(), updated_at=now()
  where owner_id is null
    and owner_email is not null
    and lower(trim(owner_email))=e;

  update public.profiles
  set role='streamer', updated_at=now()
  where id=auth.uid() and role <> 'admin'
    and exists (select 1 from public.streamers where owner_id=auth.uid());

  select * into r
  from public.streamers
  where owner_id=auth.uid()
  order by created_at desc
  limit 1;

  return r;
end;
$$;

revoke all on function public.claim_my_streamer() from public, anon;
grant execute on function public.claim_my_streamer() to authenticated;

-- =========================================================
-- 5. ADMIN APPROVAL
-- =========================================================
create or replace function public.admin_approve_application(p_application_id uuid)
returns public.streamer_applications
language plpgsql
security definer
set search_path=public
as $$
declare
  a public.streamer_applications;
  r public.streamer_applications;
begin
  if auth.uid() <> '56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid then
    raise exception 'Sul puuduvad adminiõigused';
  end if;

  select * into a from public.streamer_applications
  where id=p_application_id for update;

  if not found then raise exception 'Taotlust ei leitud'; end if;
  if a.status <> 'pending' then raise exception 'Taotlus on juba töödeldud'; end if;

  insert into public.streamers(
    name, platform, channel_url, game, avatar_url, owner_email,
    is_live, viewers, manual_live, manual_viewers, updated_at
  ) values (
    a.name, a.platform, a.channel_url, a.game, a.avatar_url, lower(trim(a.email)),
    false, 0, false, 0, now()
  );

  update public.streamer_applications
  set status='approved', approved_at=now(), approved_by=auth.uid(), updated_at=now()
  where id=a.id
  returning * into r;

  return r;
end;
$$;

revoke all on function public.admin_approve_application(uuid) from public, anon, authenticated;
grant execute on function public.admin_approve_application(uuid) to authenticated;

-- =========================================================
-- 6. STREAMER ONLINE / OFFLINE + VIEWERS
-- =========================================================
create or replace function public.set_my_stream_status(p_is_live boolean, p_viewers integer default 0)
returns public.streamers
language plpgsql
security invoker
set search_path=public
as $$
declare
  r public.streamers;
  v integer := greatest(coalesce(p_viewers,0),0);
begin
  update public.streamers
  set manual_live=p_is_live,
      manual_viewers=case when p_is_live then v else 0 end,
      is_live=p_is_live,
      viewers=case when p_is_live then v else 0 end,
      updated_at=now()
  where owner_id=auth.uid()
  returning * into r;

  if r.id is null then raise exception 'Sinu kontoga seotud striimeriprofiili ei leitud'; end if;
  return r;
end;
$$;

grant execute on function public.set_my_stream_status(boolean,integer) to authenticated;

notify pgrst, 'reload schema';
select 'STREAMHUB V30.2 USER LAYER READY' as status;

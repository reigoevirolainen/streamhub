-- ============================================================
-- STREAMHUB V30.2 DATABASE FIX / CONSOLIDATION
-- ============================================================
-- Run this ONCE in a NEW Supabase SQL query AFTER your existing MAIN.
-- It is compatible with the existing STEP 1 + STEP 2 tables.
-- Do NOT replace MAIN with this file.
-- Do NOT run the old V30.2 user-layer/final-fix SQL afterwards.
-- ============================================================

create extension if not exists pgcrypto;

grant usage on schema public to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 1. PROFILES: keep STEP 1's user_type model.
--    Do NOT introduce a second role column.
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  email text,
  avatar_url text,
  user_type text not null default 'streamer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_user_type_check check (user_type in ('streamer','admin'))
);

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists user_type text default 'streamer';
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();

update public.profiles set user_type='streamer' where user_type is null;
update public.profiles set created_at=now() where created_at is null;
update public.profiles set updated_at=now() where updated_at is null;

-- If a previous V30.2 layer created a separate role column, migrate it once.
do $migrate$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='role') then
    execute $sql$update public.profiles set user_type = case when role = 'admin' then 'admin' else 'streamer' end where role is not null$sql$;
  end if;
end $migrate$;

alter table public.profiles drop constraint if exists profiles_user_type_check;
alter table public.profiles add constraint profiles_user_type_check
check (user_type in ('streamer','admin'));

create unique index if not exists profiles_username_unique on public.profiles(username);

-- ------------------------------------------------------------
-- 2. BACKFILL EXISTING AUTH USERS SAFELY.
--    Existing users do not become admin automatically.
-- ------------------------------------------------------------
do $$
declare
  u record;
  base_name text;
  candidate text;
  n integer;
begin
  for u in
    select au.id, au.email, au.raw_user_meta_data
    from auth.users au
    left join public.profiles p on p.id=au.id
    where p.id is null
  loop
    base_name := lower(regexp_replace(
      coalesce(nullif(u.raw_user_meta_data->>'username',''), split_part(coalesce(u.email,''),'@',1), 'user'),
      '[^a-zA-Z0-9_]+', '_', 'g'
    ));
    base_name := trim(both '_' from base_name);
    if base_name = '' then base_name := 'user'; end if;
    candidate := left(base_name, 40);
    n := 0;
    while exists(select 1 from public.profiles where username=candidate) loop
      n := n + 1;
      candidate := left(base_name, 30) || '_' || n::text;
    end loop;

    insert into public.profiles(id,username,email,user_type)
    values(u.id,candidate,lower(u.email),'streamer');
  end loop;
end $$;

-- Your existing admin UID remains the admin authority.
-- If that Auth user exists, make sure its profile is admin.
insert into public.profiles(id,username,email,user_type)
select
  au.id,
  coalesce(
    nullif(au.raw_user_meta_data->>'username',''),
    'admin'
  ),
  lower(au.email),
  'admin'
from auth.users au
where au.id='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid
on conflict(id) do update
set user_type='admin', email=excluded.email, updated_at=now();

-- ------------------------------------------------------------
-- 3. PROFILE AUTO-CREATION FOR NEW AUTH USERS.
--    This is the important signup fix.
--    It does NOT require an authenticated session and therefore
--    still works when Supabase email confirmation is enabled.
-- ------------------------------------------------------------
create or replace function public.streamhub_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_name text;
  candidate text;
  n integer := 0;
begin
  base_name := lower(regexp_replace(
    coalesce(nullif(new.raw_user_meta_data->>'username',''), split_part(coalesce(new.email,''),'@',1), 'user'),
    '[^a-zA-Z0-9_]+', '_', 'g'
  ));
  base_name := trim(both '_' from base_name);
  if base_name = '' then base_name := 'user'; end if;
  candidate := left(base_name, 40);

  while exists(select 1 from public.profiles where username=candidate) loop
    n := n + 1;
    candidate := left(base_name, 30) || '_' || n::text;
  end loop;

  insert into public.profiles(id,username,email,display_name,user_type)
  values(
    new.id,
    candidate,
    lower(new.email),
    nullif(new.raw_user_meta_data->>'display_name',''),
    'streamer'
  )
  on conflict(id) do update
    set email=excluded.email,
        display_name=coalesce(excluded.display_name,public.profiles.display_name),
        updated_at=now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_v302 on auth.users;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created_streamhub
after insert on auth.users
for each row execute function public.streamhub_handle_new_user();

-- ------------------------------------------------------------
-- 4. ADMIN HELPER. Uses the existing admin UID/profile.
-- ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() = '56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid
      or exists(
        select 1 from public.profiles p
        where p.id=auth.uid() and p.user_type='admin'
      );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ------------------------------------------------------------
-- 5. PROFILE RLS. Remove the recursive STEP 1 policies.
--    Users may read/update their own profile, but cannot change role.
-- ------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "Public profiles are viewable" on public.profiles;
drop policy if exists "Users can view profiles" on public.profiles;
drop policy if exists "Users can create own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can delete own profile" on public.profiles;
drop policy if exists "Admins can manage profiles" on public.profiles;
drop policy if exists "profiles_own_select_v302" on public.profiles;
drop policy if exists "profiles_own_update_v302" on public.profiles;

create policy "streamhub_profiles_select_own"
on public.profiles for select to authenticated
using ((select auth.uid())=id);

create policy "streamhub_profiles_update_own"
on public.profiles for update to authenticated
using ((select auth.uid())=id)
with check ((select auth.uid())=id);

-- The UPDATE policy does not expose user_type as writable from the UI.
-- Database-level protection below prevents a user changing their own role.
create or replace function public.streamhub_protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and auth.uid()=old.id and new.user_type is distinct from old.user_type then
    raise exception 'Kasutaja rolli ei saa muuta';
  end if;
  return new;
end;
$$;

drop trigger if exists streamhub_protect_profile_role on public.profiles;
create trigger streamhub_protect_profile_role
before update on public.profiles
for each row execute function public.streamhub_protect_profile_role();

grant select on public.profiles to authenticated;
grant update(username,display_name,avatar_url) on public.profiles to authenticated;

-- ------------------------------------------------------------
-- 5B. ENSURE PROFILE FOR AN EXISTING AUTH USER
-- ------------------------------------------------------------
create or replace function public.ensure_my_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare r public.profiles; e text; base_name text; candidate text; n integer := 0;
begin
  if auth.uid() is null then raise exception 'Logi sisse'; end if;
  select email into e from auth.users where id=auth.uid();
  select * into r from public.profiles where id=auth.uid();
  if r.id is null then
    base_name := lower(regexp_replace(coalesce(split_part(coalesce(e,''),'@',1),'user'),'[^a-zA-Z0-9_]+','_','g'));
    base_name := trim(both '_' from base_name);
    if base_name='' then base_name='user'; end if;
    candidate := left(base_name,40);
    while exists(select 1 from public.profiles where username=candidate) loop
      n:=n+1; candidate:=left(base_name,30)||'_'||n::text;
    end loop;
    insert into public.profiles(id,username,email,user_type) values(auth.uid(),candidate,lower(e),'streamer') returning * into r;
  end if;
  return r;
end;
$$;
revoke all on function public.ensure_my_profile() from public,anon;
grant execute on function public.ensure_my_profile() to authenticated;

-- ------------------------------------------------------------
-- 6. APPLICATIONS: compatible with existing STEP 2.
-- ------------------------------------------------------------
alter table public.streamer_applications add column if not exists game text;
alter table public.streamer_applications add column if not exists avatar_url text;
alter table public.streamer_applications add column if not exists updated_at timestamptz default now();
alter table public.streamer_applications add column if not exists reviewed_at timestamptz;
alter table public.streamer_applications add column if not exists reviewed_by uuid references auth.users(id);
alter table public.streamer_applications add column if not exists approved_at timestamptz;
alter table public.streamer_applications add column if not exists approved_by uuid references auth.users(id);

alter table public.streamer_applications enable row level security;

grant insert on public.streamer_applications to anon, authenticated;
grant select,update,delete on public.streamer_applications to authenticated;

-- Keep existing policies harmless, but add a clearly named admin/public set.
drop policy if exists "streamhub_apps_public_insert" on public.streamer_applications;
drop policy if exists "streamhub_apps_admin_select" on public.streamer_applications;
drop policy if exists "streamhub_apps_admin_update" on public.streamer_applications;
drop policy if exists "streamhub_apps_admin_delete" on public.streamer_applications;

create policy "streamhub_apps_public_insert"
on public.streamer_applications for insert to anon,authenticated
with check (
  coalesce(status,'pending')='pending'
  and length(trim(name)) between 2 and 80
  and length(trim(email)) between 5 and 254
  and platform in ('Twitch','YouTube','Kick','TikTok')
  and length(trim(channel_url)) between 8 and 1000
);

create policy "streamhub_apps_admin_select"
on public.streamer_applications for select to authenticated
using ((select public.is_admin()));

create policy "streamhub_apps_admin_update"
on public.streamer_applications for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "streamhub_apps_admin_delete"
on public.streamer_applications for delete to authenticated
using ((select public.is_admin()));

-- ------------------------------------------------------------
-- 7. APPLICATION SUBMISSION RPC.
--    Frontend uses this instead of depending on conflicting RLS names.
-- ------------------------------------------------------------
create or replace function public.submit_streamer_application(
  p_name text,
  p_email text,
  p_platform text,
  p_channel_url text,
  p_game text default null,
  p_avatar_url text default null,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare new_id uuid;
begin
  if nullif(trim(p_name),'') is null then raise exception 'Striimeri nimi on kohustuslik'; end if;
  if nullif(trim(p_email),'') is null then raise exception 'E-post on kohustuslik'; end if;
  if p_platform not in ('Twitch','YouTube','Kick','TikTok') then raise exception 'Tundmatu platvorm'; end if;
  if nullif(trim(p_channel_url),'') is null then raise exception 'Kanali URL on kohustuslik'; end if;

  insert into public.streamer_applications
    (name,email,platform,channel_url,game,avatar_url,message,status,created_at,updated_at)
  values
    (trim(p_name),lower(trim(p_email)),p_platform,trim(p_channel_url),
     nullif(trim(coalesce(p_game,'')),''),
     nullif(trim(coalesce(p_avatar_url,'')),''),
     nullif(trim(coalesce(p_message,'')),''),
     'pending',now(),now())
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.submit_streamer_application(text,text,text,text,text,text,text) from public;
grant execute on function public.submit_streamer_application(text,text,text,text,text,text,text) to anon,authenticated;

-- ------------------------------------------------------------
-- 8. STREAMER OWNERSHIP.
-- ------------------------------------------------------------
alter table public.streamers add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.streamers add column if not exists owner_email text;
create index if not exists streamers_owner_id_idx on public.streamers(owner_id);
create index if not exists streamers_game_idx on public.streamers(lower(game));

alter table public.streamers enable row level security;
grant select on public.streamers to anon,authenticated;

-- Remove the V30.2 owner UPDATE policy. It allowed the streamer to edit viewers,
-- thumbnail and other protected fields directly.
drop policy if exists "streamers_owner_select_v302" on public.streamers;
drop policy if exists "streamers_owner_update_v302" on public.streamers;
drop policy if exists "Streamer can update own row" on public.streamers;

-- ------------------------------------------------------------
-- 9. STREAMER CLAIM RPC.
-- ------------------------------------------------------------
create or replace function public.claim_my_streamer()
returns public.streamers
language plpgsql
security definer
set search_path = public
as $$
declare r public.streamers;
      e text;
begin
  if auth.uid() is null then raise exception 'Logi sisse'; end if;
  select lower(trim(email)) into e from auth.users where id=auth.uid();

  update public.streamers s
  set owner_id=auth.uid(), updated_at=now()
  where s.id = (
    select s2.id from public.streamers s2
    where s2.owner_id is null
      and s2.owner_email is not null
      and lower(trim(s2.owner_email))=e
    order by s2.created_at asc
    limit 1
  )
  returning s.* into r;

  if r.id is null then raise exception 'Kinnitatud striimeriprofiili ei leitud'; end if;

  update public.profiles
  set user_type='streamer', updated_at=now()
  where id=auth.uid()
    and auth.uid()<>'56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid;

  return r;
end;
$$;
revoke all on function public.claim_my_streamer() from public,anon;
grant execute on function public.claim_my_streamer() to authenticated;

-- ------------------------------------------------------------
-- 10. ADMIN APPROVAL RPC.
-- ------------------------------------------------------------
create or replace function public.admin_approve_application(p_application_id uuid)
returns public.streamer_applications
language plpgsql
security definer
set search_path = public
as $$
declare a public.streamer_applications; r public.streamer_applications;
begin
  if not public.is_admin() then raise exception 'Sul puuduvad adminiõigused'; end if;

  select * into a from public.streamer_applications where id=p_application_id for update;
  if not found then raise exception 'Taotlust ei leitud'; end if;
  if a.status<>'pending' then raise exception 'Taotlus on juba töödeldud'; end if;

  insert into public.streamers(
    name,platform,channel_url,game,avatar_url,owner_email,is_live,viewers,manual_live,manual_viewers,updated_at
  ) values(
    a.name,a.platform,a.channel_url,a.game,a.avatar_url,lower(trim(a.email)),false,0,false,0,now()
  );

  update public.streamer_applications
  set status='approved',approved_at=now(),approved_by=auth.uid(),reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now()
  where id=a.id
  returning * into r;

  return r;
end;
$$;
revoke all on function public.admin_approve_application(uuid) from public,anon,authenticated;
grant execute on function public.admin_approve_application(uuid) to authenticated;

-- ------------------------------------------------------------
-- 11. STREAMER ONLINE/OFFLINE ONLY.
--    Viewer count is NEVER accepted from the streamer.
--    The API sync/admin controls viewers.
-- ------------------------------------------------------------
create or replace function public.set_my_stream_live(p_is_live boolean)
returns public.streamers
language plpgsql
security definer
set search_path = public
as $$
declare r public.streamers;
begin
  if auth.uid() is null then raise exception 'Logi sisse'; end if;

  update public.streamers
  set manual_live=p_is_live,
      is_live=p_is_live,
      manual_viewers=0,
      viewers=case when p_is_live then viewers else 0 end,
      updated_at=now()
  where owner_id=auth.uid()
  returning * into r;

  if r.id is null then raise exception 'Sinu kontoga seotud striimeriprofiili ei leitud'; end if;
  return r;
end;
$$;
revoke all on function public.set_my_stream_live(boolean) from public,anon;
grant execute on function public.set_my_stream_live(boolean) to authenticated;

-- Remove the old viewer-edit RPC if it exists.
drop function if exists public.set_my_stream_status(boolean,integer);

-- ------------------------------------------------------------
-- 12. EXISTING MAIN sync function remains the source of truth for viewers.
--    Its service_role permission is preserved.
-- ------------------------------------------------------------
notify pgrst,'reload schema';

select
  'STREAMHUB V30.2 DATABASE FIX READY' as status,
  'MAIN preserved' as main_status,
  'Step 1 user_type preserved' as profiles_status,
  'Step 2 applications preserved' as applications_status,
  'Streamer can change only ONLINE/OFFLINE' as streamer_status,
  'Viewer count controlled by sync/admin' as viewer_status;

-- ============================================================
-- STREAMHUB V33.2 COMPATIBILITY / ADMIN REPAIR
-- ============================================================
-- These functions fix the exact PGRST202 error seen when the
-- frontend calls admin_update_streamer(). They are additive and
-- do not delete existing users, streamers or applications.

-- Allow a signed-in applicant to see only their own application.
drop policy if exists "streamhub_apps_owner_select_v332" on public.streamer_applications;
create policy "streamhub_apps_owner_select_v332"
on public.streamer_applications
for select to authenticated
using (
  lower(trim(email)) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
);

-- Admin can edit protected streamer fields through a controlled RPC.
create or replace function public.admin_update_streamer(
  p_streamer_id uuid,
  p_name text,
  p_game text,
  p_thumbnail_url text,
  p_channel_url text
)
returns public.streamers
language plpgsql
security definer
set search_path = public
as $$
declare r public.streamers;
begin
  if not public.is_admin() then
    raise exception 'Sul puuduvad adminiõigused';
  end if;

  if p_streamer_id is null then
    raise exception 'Striimeri ID puudub';
  end if;
  if nullif(trim(p_name), '') is null then
    raise exception 'Nimi on kohustuslik';
  end if;
  if nullif(trim(p_channel_url), '') is null then
    raise exception 'Kanali URL on kohustuslik';
  end if;

  update public.streamers
  set name = trim(p_name),
      game = nullif(trim(coalesce(p_game, '')), ''),
      thumbnail_url = nullif(trim(coalesce(p_thumbnail_url, '')), ''),
      channel_url = trim(p_channel_url),
      updated_at = now()
  where id = p_streamer_id
  returning * into r;

  if r.id is null then
    raise exception 'Striimerit ei leitud';
  end if;

  return r;
end;
$$;

revoke all on function public.admin_update_streamer(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.admin_update_streamer(uuid,text,text,text,text) to authenticated;

-- Admin-only streamer deletion. Direct table DELETE is not exposed.
create or replace function public.admin_delete_streamer(p_streamer_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Sul puuduvad adminiõigused';
  end if;

  delete from public.streamers where id = p_streamer_id;
  return found;
end;
$$;

revoke all on function public.admin_delete_streamer(uuid) from public,anon,authenticated;
grant execute on function public.admin_delete_streamer(uuid) to authenticated;

-- Admin-only rejection RPC, so the frontend never relies on a
-- broad UPDATE permission for application status changes.
create or replace function public.admin_reject_application(p_application_id uuid)
returns public.streamer_applications
language plpgsql
security definer
set search_path = public
as $$
declare r public.streamer_applications;
begin
  if not public.is_admin() then
    raise exception 'Sul puuduvad adminiõigused';
  end if;

  update public.streamer_applications
  set status='rejected',
      reviewed_at=now(),
      reviewed_by=auth.uid(),
      updated_at=now()
  where id=p_application_id
    and status='pending'
  returning * into r;

  if r.id is null then
    raise exception 'Taotlust ei leitud või see on juba töödeldud';
  end if;

  return r;
end;
$$;

revoke all on function public.admin_reject_application(uuid) from public,anon,authenticated;
grant execute on function public.admin_reject_application(uuid) to authenticated;

notify pgrst, 'reload schema';

select
  'STREAMHUB V33.2 DATABASE READY' as status,
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_update_streamer') as admin_update_ready,
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_delete_streamer') as admin_delete_ready,
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_reject_application') as admin_reject_ready,
  exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal) as signup_trigger_ready;

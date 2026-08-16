-- =========================================================
-- STREAMHUB V30.2 USER LAYER
-- IMPORTANT: this is an ADDITIVE migration.
-- Do NOT replace the existing MAIN/V15 SQL with this file.
-- Run this file ONCE after the existing MAIN SQL.
-- Existing ADMIN_UID and streamers policies are intentionally kept.
-- =========================================================

create table if not exists public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check(role in('user','streamer','admin'))
);

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists role text default 'user';
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();

-- Existing users get a normal user profile. Never grant admin here.
insert into public.profiles(id,username,role)
select u.id, coalesce(nullif(u.raw_user_meta_data->>'username',''),split_part(coalesce(u.email,''),'@',1)), 'user'
from auth.users u
on conflict(id) do nothing;

create or replace function public.handle_new_user_v302()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,username,role)
  values(new.id,coalesce(nullif(new.raw_user_meta_data->>'username',''),split_part(coalesce(new.email,''),'@',1)),'user')
  on conflict(id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created_v302 on auth.users;
create trigger on_auth_user_created_v302 after insert on auth.users
for each row execute function public.handle_new_user_v302();

alter table public.profiles enable row level security;
drop policy if exists "profiles_own_select_v302" on public.profiles;
drop policy if exists "profiles_own_update_v302" on public.profiles;
create policy "profiles_own_select_v302" on public.profiles for select to authenticated using((select auth.uid())=id);
create policy "profiles_own_update_v302" on public.profiles for update to authenticated using((select auth.uid())=id) with check((select auth.uid())=id and role<>'admin');
grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
grant update(username) on public.profiles to authenticated;

-- Add application fields without deleting existing applications.
alter table public.streamer_applications add column if not exists game text;
alter table public.streamer_applications add column if not exists avatar_url text;
alter table public.streamer_applications add column if not exists approved_at timestamptz;
alter table public.streamer_applications add column if not exists approved_by uuid;
alter table public.streamer_applications add column if not exists approved_user_id uuid references auth.users(id) on delete set null;

-- Link streamers to Auth users. Existing streamers remain untouched.
alter table public.streamers add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.streamers add column if not exists owner_email text;
create index if not exists streamers_owner_id_idx on public.streamers(owner_id);
create index if not exists streamers_game_idx on public.streamers(lower(game));

-- Streamer can read/update only their own streamer row. Public read policy from MAIN remains.
drop policy if exists "streamers_owner_select_v302" on public.streamers;
drop policy if exists "streamers_owner_update_v302" on public.streamers;
create policy "streamers_owner_select_v302" on public.streamers for select to authenticated using((select auth.uid())=owner_id);
create policy "streamers_owner_update_v302" on public.streamers for update to authenticated
using((select auth.uid())=owner_id)
with check((select auth.uid())=owner_id);
grant select,update on public.streamers to authenticated;

-- Public application INSERT is already present in MAIN; replace only to allow the optional fields.
drop policy if exists "apps_public_insert_v302" on public.streamer_applications;
create policy "apps_public_insert_v302" on public.streamer_applications for insert to anon,authenticated
with check(
  length(trim(name)) between 2 and 80 and
  length(trim(email)) between 5 and 254 and
  platform in('Twitch','YouTube','Kick','TikTok') and
  length(trim(channel_url)) between 8 and 500
);
grant insert on public.streamer_applications to anon,authenticated;

-- Claim an approved streamer profile by matching the logged-in user's e-mail.
create or replace function public.claim_my_streamer()
returns public.streamers
language plpgsql security definer set search_path=public as $$
declare r public.streamers; e text;
begin
  if auth.uid() is null then raise exception 'Logi sisse'; end if;
  select lower(trim(email)) into e from auth.users where id=auth.uid();
  update public.streamers set owner_id=auth.uid(),updated_at=now()
  where owner_id is null and owner_email is not null and lower(trim(owner_email))=e;
  if exists(select 1 from public.streamers where owner_id=auth.uid()) then
    update public.profiles set role='streamer',updated_at=now() where id=auth.uid() and role<>'admin';
  end if;
  select * into r from public.streamers where owner_id=auth.uid() order by created_at desc limit 1;
  return r;
end $$;
revoke all on function public.claim_my_streamer() from public,anon;
grant execute on function public.claim_my_streamer() to authenticated;

-- Admin approval: keeps the existing ADMIN_UID check and creates the catalog row.
create or replace function public.admin_approve_application(p_application_id uuid)
returns public.streamer_applications
language plpgsql security definer set search_path=public as $$
declare a public.streamer_applications; r public.streamer_applications;
begin
  if auth.uid()<>'56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid then raise exception 'Sul puuduvad adminiõigused'; end if;
  select * into a from public.streamer_applications where id=p_application_id for update;
  if not found then raise exception 'Taotlust ei leitud'; end if;
  if a.status<>'pending' then raise exception 'Taotlus on juba töödeldud'; end if;
  insert into public.streamers(name,platform,channel_url,game,avatar_url,owner_email,is_live,viewers,manual_live,manual_viewers)
  values(a.name,a.platform,a.channel_url,a.game,a.avatar_url,lower(trim(a.email)),false,0,false,0);
  update public.streamer_applications set status='approved',approved_at=now(),approved_by=auth.uid() where id=a.id returning * into r;
  return r;
end $$;
revoke all on function public.admin_approve_application(uuid) from public,anon;
grant execute on function public.admin_approve_application(uuid) to authenticated;

-- Manual streamer status: sync function in MAIN already respects manual_live.
-- This function changes only the authenticated user's own row.
create or replace function public.set_my_stream_status(p_is_live boolean,p_viewers integer default 0)
returns public.streamers
language plpgsql security invoker set search_path=public as $$
declare r public.streamers; v integer:=greatest(coalesce(p_viewers,0),0);
begin
  update public.streamers set manual_live=p_is_live,manual_viewers=case when p_is_live then v else 0 end,is_live=p_is_live,viewers=case when p_is_live then v else 0 end,updated_at=now()
  where owner_id=auth.uid() returning * into r;
  if r.id is null then raise exception 'Sinu kontoga seotud striimeriprofiili ei leitud'; end if;
  return r;
end $$;
grant execute on function public.set_my_stream_status(boolean,integer) to authenticated;

notify pgrst,'reload schema';
select 'STREAMHUB V30.2 USER LAYER READY' as status;

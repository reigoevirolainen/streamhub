-- ============================================================
-- STREAMHUB V33 FINAL DATABASE
-- ONE migration for the current StreamHub project.
-- Run ONCE in a NEW Supabase SQL query.
-- It preserves existing profiles, streamers and applications.
-- It keeps the original ADMIN UID and user_type model.
-- ============================================================

create extension if not exists pgcrypto;
grant usage on schema public to anon, authenticated, service_role;

-- ---------- PROFILES ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  email text,
  avatar_url text,
  user_type text not null default 'streamer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists user_type text default 'streamer';
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();

update public.profiles p set email=coalesce(p.email,(select u.email from auth.users u where u.id=p.id)) where p.email is null;
update public.profiles set user_type='streamer' where user_type is null or user_type not in ('streamer','admin');
update public.profiles set created_at=coalesce(created_at,now()), updated_at=coalesce(updated_at,now());

-- Migrate any accidental V30 role column back to the original user_type model.
do $$ begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='role') then
    execute $q$update public.profiles set user_type=case when role='admin' then 'admin' else 'streamer' end where role is not null$q$;
  end if;
end $$;

alter table public.profiles drop constraint if exists profiles_user_type_check;
alter table public.profiles add constraint profiles_user_type_check check(user_type in ('streamer','admin'));
create unique index if not exists profiles_username_lower_idx on public.profiles(lower(username));

-- Fill profiles for any existing Auth users that do not have one.
do $$
declare u record; base text; candidate text; n int;
begin
  for u in select au.id,au.email,au.raw_user_meta_data from auth.users au left join public.profiles p on p.id=au.id where p.id is null loop
    base:=lower(regexp_replace(coalesce(nullif(u.raw_user_meta_data->>'username',''),split_part(coalesce(u.email,''),'@',1),'user'),'[^a-zA-Z0-9_]+','_','g'));
    base:=trim(both '_' from base); if base='' then base:='user'; end if;
    candidate:=left(base,40); n:=0;
    while exists(select 1 from public.profiles where lower(username)=lower(candidate)) loop n:=n+1; candidate:=left(base,30)||'_'||n::text; end loop;
    insert into public.profiles(id,username,email,user_type) values(u.id,candidate,lower(u.email),'streamer');
  end loop;
end $$;

-- ---------- ONE AUTH PROFILE TRIGGER ----------
create or replace function public.streamhub_v33_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare base text; candidate text; n int:=0;
begin
  base:=lower(regexp_replace(coalesce(nullif(new.raw_user_meta_data->>'username',''),split_part(coalesce(new.email,''),'@',1),'user'),'[^a-zA-Z0-9_]+','_','g'));
  base:=trim(both '_' from base); if base='' then base:='user'; end if;
  candidate:=left(base,40);
  while exists(select 1 from public.profiles where lower(username)=lower(candidate) and id<>new.id) loop n:=n+1; candidate:=left(base,30)||'_'||n::text; end loop;
  insert into public.profiles(id,username,email,display_name,user_type)
  values(new.id,candidate,lower(new.email),nullif(new.raw_user_meta_data->>'display_name',''),'streamer')
  on conflict(id) do update set email=excluded.email,updated_at=now();
  return new;
end;
$$;
revoke all on function public.streamhub_v33_handle_new_user() from public,anon,authenticated;
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_created_v302 on auth.users;
drop trigger if exists on_auth_user_created_streamhub on auth.users;
drop trigger if exists on_auth_user_created_streamhub_v33 on auth.users;
create trigger on_auth_user_created_streamhub_v33 after insert on auth.users for each row execute function public.streamhub_v33_handle_new_user();

-- ---------- ADMIN ----------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path=public
as $$
  select auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid
      or exists(select 1 from public.profiles p where p.id=auth.uid() and p.user_type='admin');
$$;
revoke all on function public.is_admin() from public,anon;
grant execute on function public.is_admin() to authenticated;

do $$
begin
  insert into public.profiles(id,username,email,display_name,user_type)
  select au.id,'admin',lower(au.email),'StreamHub Admin','admin' from auth.users au
  where au.id='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid
  on conflict(id) do update set user_type='admin',email=excluded.email,display_name='StreamHub Admin',updated_at=now();
exception when unique_violation then
  update public.profiles set user_type='admin',updated_at=now() where id='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid;
end $$;

-- ---------- PROFILE RLS ----------
alter table public.profiles enable row level security;
drop policy if exists "Public profiles are viewable" on public.profiles;
drop policy if exists "Users can view profiles" on public.profiles;
drop policy if exists "Users can create own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can delete own profile" on public.profiles;
drop policy if exists "Admins can manage profiles" on public.profiles;
drop policy if exists "streamhub_profiles_select_own" on public.profiles;
drop policy if exists "streamhub_profiles_update_own" on public.profiles;
create policy "streamhub_v33_profiles_select_own" on public.profiles for select to authenticated using((select auth.uid())=id or (select public.is_admin()));
create policy "streamhub_v33_profiles_update_own" on public.profiles for update to authenticated using((select auth.uid())=id or (select public.is_admin())) with check((select auth.uid())=id or (select public.is_admin()));
grant select on public.profiles to authenticated;
revoke update on public.profiles from authenticated;
grant update(username,display_name,avatar_url) on public.profiles to authenticated;

create or replace function public.ensure_my_profile()
returns public.profiles language plpgsql security definer set search_path=public
as $$
declare r public.profiles; e text; base text; candidate text; n int:=0;
begin
  if auth.uid() is null then raise exception 'Logi sisse'; end if;
  select email into e from auth.users where id=auth.uid();
  select * into r from public.profiles where id=auth.uid();
  if r.id is null then
    base:=lower(regexp_replace(coalesce(split_part(coalesce(e,''),'@',1),'user'),'[^a-zA-Z0-9_]+','_','g')); base:=trim(both '_' from base); if base='' then base:='user'; end if;
    candidate:=left(base,40);
    while exists(select 1 from public.profiles where lower(username)=lower(candidate)) loop n:=n+1; candidate:=left(base,30)||'_'||n::text; end loop;
    insert into public.profiles(id,username,email,user_type) values(auth.uid(),candidate,lower(e),'streamer') returning * into r;
  end if;
  return r;
end $$;
revoke all on function public.ensure_my_profile() from public,anon;
grant execute on function public.ensure_my_profile() to authenticated;

-- ---------- APPLICATIONS ----------
create table if not exists public.streamer_applications(
 id uuid primary key default gen_random_uuid(), name text not null, email text not null, platform text not null, channel_url text not null,
 game text, avatar_url text, message text, status text not null default 'pending', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), reviewed_at timestamptz, reviewed_by uuid references auth.users(id), approved_at timestamptz, approved_by uuid references auth.users(id)
);
alter table public.streamer_applications add column if not exists game text;
alter table public.streamer_applications add column if not exists avatar_url text;
alter table public.streamer_applications add column if not exists message text;
alter table public.streamer_applications add column if not exists updated_at timestamptz default now();
alter table public.streamer_applications add column if not exists reviewed_at timestamptz;
alter table public.streamer_applications add column if not exists reviewed_by uuid references auth.users(id);
alter table public.streamer_applications add column if not exists approved_at timestamptz;
alter table public.streamer_applications add column if not exists approved_by uuid references auth.users(id);
alter table public.streamer_applications drop constraint if exists streamer_applications_platform_check;
alter table public.streamer_applications add constraint streamer_applications_platform_check check(platform in('Twitch','YouTube','Kick','TikTok'));
alter table public.streamer_applications drop constraint if exists streamer_applications_status_check;
alter table public.streamer_applications add constraint streamer_applications_status_check check(status in('pending','approved','rejected'));
alter table public.streamer_applications enable row level security;
grant insert on public.streamer_applications to anon,authenticated;
grant select,update,delete on public.streamer_applications to authenticated;

drop policy if exists "Anyone can submit streamer application" on public.streamer_applications;
drop policy if exists "Admins can view applications" on public.streamer_applications;
drop policy if exists "Admins can update applications" on public.streamer_applications;
drop policy if exists "streamhub_apps_public_insert" on public.streamer_applications;
drop policy if exists "streamhub_apps_admin_select" on public.streamer_applications;
drop policy if exists "streamhub_apps_admin_update" on public.streamer_applications;
drop policy if exists "streamhub_apps_admin_delete" on public.streamer_applications;
create policy "streamhub_v33_apps_insert" on public.streamer_applications for insert to anon,authenticated with check(status='pending');
create policy "streamhub_v33_apps_admin_select" on public.streamer_applications for select to authenticated using((select public.is_admin()));
create policy "streamhub_v33_apps_admin_update" on public.streamer_applications for update to authenticated using((select public.is_admin())) with check((select public.is_admin()));
create policy "streamhub_v33_apps_admin_delete" on public.streamer_applications for delete to authenticated using((select public.is_admin()));

create or replace function public.submit_streamer_application(p_name text,p_email text,p_platform text,p_channel_url text,p_game text default null,p_avatar_url text default null,p_message text default null)
returns uuid language plpgsql security definer set search_path=public
as $$ declare new_id uuid; begin
 if length(trim(coalesce(p_name,'')))<2 then raise exception 'Striimeri nimi on kohustuslik'; end if;
 if length(trim(coalesce(p_email,'')))<5 then raise exception 'E-post on kohustuslik'; end if;
 if p_platform not in('Twitch','YouTube','Kick','TikTok') then raise exception 'Tundmatu platvorm'; end if;
 if length(trim(coalesce(p_channel_url,'')))<8 then raise exception 'Kanali URL on kohustuslik'; end if;
 insert into public.streamer_applications(name,email,platform,channel_url,game,avatar_url,message,status) values(trim(p_name),lower(trim(p_email)),p_platform,trim(p_channel_url),nullif(trim(coalesce(p_game,'')),''),nullif(trim(coalesce(p_avatar_url,'')),''),nullif(trim(coalesce(p_message,'')),''),'pending') returning id into new_id;
 return new_id;
end $$;
revoke all on function public.submit_streamer_application(text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_streamer_application(text,text,text,text,text,text,text) to anon,authenticated;

-- ---------- STREAMERS ----------
create table if not exists public.streamers(
 id uuid primary key default gen_random_uuid(), name text not null, platform text not null, channel_url text not null, game text, avatar_url text, thumbnail_url text,
 is_live boolean not null default false, viewers integer not null default 0, manual_live boolean not null default false, manual_viewers integer not null default 0,
 live_video_id text, sync_error text, owner_id uuid references auth.users(id) on delete set null, owner_email text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.streamers add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.streamers add column if not exists owner_email text;
alter table public.streamers add column if not exists thumbnail_url text;
alter table public.streamers add column if not exists manual_live boolean default false;
alter table public.streamers add column if not exists manual_viewers integer default 0;
alter table public.streamers add column if not exists live_video_id text;
alter table public.streamers add column if not exists sync_error text;
alter table public.streamers add column if not exists created_at timestamptz default now();
alter table public.streamers add column if not exists updated_at timestamptz default now();
alter table public.streamers enable row level security;
grant select on public.streamers to anon,authenticated;
grant insert,update,delete on public.streamers to authenticated;
drop policy if exists "streamers_owner_select_v302" on public.streamers;
drop policy if exists "streamers_owner_update_v302" on public.streamers;
drop policy if exists "Streamer can update own row" on public.streamers;
drop policy if exists "streamhub_streamers_public_select" on public.streamers;
drop policy if exists "streamhub_streamers_admin_write" on public.streamers;
create policy "streamhub_v33_streamers_public_select" on public.streamers for select to anon,authenticated using(true);
create policy "streamhub_v33_streamers_admin_write" on public.streamers for all to authenticated using((select public.is_admin())) with check((select public.is_admin()));
create index if not exists streamers_owner_id_idx on public.streamers(owner_id);
create index if not exists streamers_game_lower_idx on public.streamers(lower(game));

-- ---------- STREAMER CLAIM ----------
create or replace function public.claim_my_streamer()
returns public.streamers language plpgsql security definer set search_path=public
as $$ declare r public.streamers; e text; begin
 if auth.uid() is null then raise exception 'Logi sisse'; end if;
 select lower(email) into e from auth.users where id=auth.uid();
 update public.streamers s set owner_id=auth.uid(),updated_at=now() where s.id=(select s2.id from public.streamers s2 where s2.owner_id is null and lower(trim(coalesce(s2.owner_email,'')))=e order by s2.created_at asc limit 1) returning s.* into r;
 if r.id is null then raise exception 'Kinnitatud striimeriprofiili ei leitud'; end if;
 return r;
end $$;
revoke all on function public.claim_my_streamer() from public,anon;
grant execute on function public.claim_my_streamer() to authenticated;

-- ---------- STREAMER ONLINE/OFFLINE ----------
create or replace function public.set_my_stream_live(p_is_live boolean)
returns public.streamers language plpgsql security definer set search_path=public
as $$ declare r public.streamers; begin
 if auth.uid() is null then raise exception 'Logi sisse'; end if;
 update public.streamers set manual_live=p_is_live,is_live=p_is_live,updated_at=now() where owner_id=auth.uid() returning * into r;
 if r.id is null then raise exception 'Sinu kontoga seotud striimeriprofiili ei leitud'; end if;
 return r;
end $$;
revoke all on function public.set_my_stream_live(boolean) from public,anon;
grant execute on function public.set_my_stream_live(boolean) to authenticated;

drop function if exists public.set_my_stream_status(boolean,integer);

-- ---------- ADMIN APPLICATION APPROVAL ----------
create or replace function public.admin_approve_application(p_application_id uuid)
returns public.streamer_applications language plpgsql security definer set search_path=public
as $$ declare a public.streamer_applications; r public.streamer_applications; begin
 if not public.is_admin() then raise exception 'Sul puuduvad adminiõigused'; end if;
 select * into a from public.streamer_applications where id=p_application_id for update;
 if not found then raise exception 'Taotlust ei leitud'; end if;
 if a.status<>'pending' then raise exception 'Taotlus on juba töödeldud'; end if;
 insert into public.streamers(name,platform,channel_url,game,avatar_url,owner_email,is_live,viewers,manual_live,manual_viewers,updated_at) values(a.name,a.platform,a.channel_url,a.game,a.avatar_url,lower(trim(a.email)),false,0,false,0,now());
 update public.streamer_applications set status='approved',approved_at=now(),approved_by=auth.uid(),reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now() where id=a.id returning * into r;
 return r;
end $$;
revoke all on function public.admin_approve_application(uuid) from public,anon,authenticated;
grant execute on function public.admin_approve_application(uuid) to authenticated;

create or replace function public.admin_reject_application(p_application_id uuid)
returns public.streamer_applications language plpgsql security definer set search_path=public
as $$ declare r public.streamer_applications; begin
 if not public.is_admin() then raise exception 'Sul puuduvad adminiõigused'; end if;
 update public.streamer_applications set status='rejected',reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now() where id=p_application_id and status='pending' returning * into r;
 if r.id is null then raise exception 'Pending taotlust ei leitud'; end if; return r;
end $$;
revoke all on function public.admin_reject_application(uuid) from public,anon,authenticated;
grant execute on function public.admin_reject_application(uuid) to authenticated;

-- ---------- ADMIN STREAMER WRITE ----------
create or replace function public.admin_update_streamer(p_streamer_id uuid,p_name text,p_game text,p_thumbnail_url text,p_channel_url text)
returns public.streamers language plpgsql security definer set search_path=public
as $$ declare r public.streamers; begin
 if not public.is_admin() then raise exception 'Sul puuduvad adminiõigused'; end if;
 update public.streamers set name=trim(p_name),game=nullif(trim(coalesce(p_game,'')),''),thumbnail_url=nullif(trim(coalesce(p_thumbnail_url,'')),''),channel_url=trim(p_channel_url),updated_at=now() where id=p_streamer_id returning * into r;
 if r.id is null then raise exception 'Striimerit ei leitud'; end if; return r;
end $$;
revoke all on function public.admin_update_streamer(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.admin_update_streamer(uuid,text,text,text,text) to authenticated;

create or replace function public.admin_delete_streamer(p_streamer_id uuid)
returns boolean language plpgsql security definer set search_path=public
as $$ begin
 if not public.is_admin() then raise exception 'Sul puuduvad adminiõigused'; end if;
 delete from public.streamers where id=p_streamer_id;
 return found;
end $$;
revoke all on function public.admin_delete_streamer(uuid) from public,anon,authenticated;
grant execute on function public.admin_delete_streamer(uuid) to authenticated;

-- ---------- API SYNC RPC ----------
-- Service role / Edge Function uses this to write authoritative viewers and thumbnails.
create or replace function public.sync_streamer_status(p_id uuid,p_is_live boolean,p_viewers integer,p_game text,p_thumbnail_url text,p_live_video_id text,p_error text)
returns public.streamers language plpgsql security definer set search_path=public
as $$ declare r public.streamers; begin
 update public.streamers
 set is_live=(p_is_live or coalesce(manual_live,false)),
     viewers=greatest(0,coalesce(p_viewers,0)),
     game=coalesce(nullif(trim(p_game),''),game),
     thumbnail_url=coalesce(nullif(trim(p_thumbnail_url),''),thumbnail_url),
     live_video_id=p_live_video_id,
     sync_error=p_error,
     updated_at=now()
 where id=p_id returning * into r;
 if r.id is null then raise exception 'Striimerit ei leitud'; end if; return r;
end $$;
revoke all on function public.sync_streamer_status(uuid,boolean,integer,text,text,text,text) from public,anon,authenticated;
grant execute on function public.sync_streamer_status(uuid,boolean,integer,text,text,text,text) to service_role;

-- ---------- TIMESTAMP ----------
create or replace function public.streamhub_v33_updated_at() returns trigger language plpgsql security definer set search_path=public as $$ begin new.updated_at=now(); return new; end $$;
drop trigger if exists streamhub_streamers_updated_at on public.streamers;
create trigger streamhub_streamers_updated_at before update on public.streamers for each row execute function public.streamhub_v33_updated_at();

notify pgrst,'reload schema';
select 'STREAMHUB V33 DATABASE READY' as status, true as auth_ready, true as applications_ready, true as streamers_ready, true as admin_ready, true as viewer_protection_ready;

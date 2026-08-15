-- =========================================================
-- STREAMHUB V15 DATABASE
-- Run this whole file once in Supabase SQL Editor as postgres.
-- =========================================================
create extension if not exists pgcrypto;
create extension if not exists pg_net;

grant usage on schema public to anon, authenticated, service_role, postgres;
grant create on schema public to postgres;

create table if not exists public.streamers(
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
 last_checked_at timestamptz,
 last_live_at timestamptz,
 sync_error text,
 manual_live boolean not null default false,
 manual_viewers integer not null default 0,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

alter table public.streamers add column if not exists game text;
alter table public.streamers add column if not exists avatar_url text;
alter table public.streamers add column if not exists thumbnail_url text;
alter table public.streamers add column if not exists live_video_id text;
alter table public.streamers add column if not exists is_live boolean default false;
alter table public.streamers add column if not exists viewers integer default 0;
alter table public.streamers add column if not exists last_checked_at timestamptz;
alter table public.streamers add column if not exists last_live_at timestamptz;
alter table public.streamers add column if not exists sync_error text;
alter table public.streamers add column if not exists manual_live boolean not null default false;
alter table public.streamers add column if not exists manual_viewers integer not null default 0;
alter table public.streamers add column if not exists created_at timestamptz default now();
alter table public.streamers add column if not exists updated_at timestamptz default now();

alter table public.streamers drop constraint if exists streamers_platform_check;
alter table public.streamers add constraint streamers_platform_check check(platform in('Twitch','YouTube','Kick','TikTok'));
alter table public.streamers drop constraint if exists streamers_viewers_check;
alter table public.streamers add constraint streamers_viewers_check check(viewers>=0);

create or replace function public.touch_streamer()
returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
drop trigger if exists streamers_touch on public.streamers;
create trigger streamers_touch before update on public.streamers for each row execute function public.touch_streamer();

alter table public.streamers enable row level security;
grant select on public.streamers to anon,authenticated;
grant insert,update,delete on public.streamers to authenticated;
grant all on public.streamers to service_role;

drop policy if exists "streamers_public_read" on public.streamers;
drop policy if exists "streamers_admin_insert" on public.streamers;
drop policy if exists "streamers_admin_update" on public.streamers;
drop policy if exists "streamers_admin_delete" on public.streamers;

create policy "streamers_public_read" on public.streamers for select to anon,authenticated using(true);
create policy "streamers_admin_insert" on public.streamers for insert to authenticated with check(auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);
create policy "streamers_admin_update" on public.streamers for update to authenticated using(auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid) with check(auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);
create policy "streamers_admin_delete" on public.streamers for delete to authenticated using(auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);

-- Delete ALL old signatures that caused "Could not find function ... in schema cache".
drop function if exists public.admin_add_streamer(text,text,text,text);
drop function if exists public.admin_add_streamer(text,text,text,text,text,text);
drop function if exists public.admin_add_streamer(text,text,text,text,text,text,integer);

create or replace function public.admin_add_streamer(
 p_avatar_url text,p_channel_url text,p_game text,p_name text,p_platform text
) returns public.streamers
language plpgsql security definer set search_path=public as $$
declare r public.streamers;
begin
 if auth.uid() is null or auth.uid()<>'56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid then raise exception 'Sul puuduvad adminiõigused'; end if;
 if p_platform not in('Twitch','YouTube','Kick','TikTok') then raise exception 'Tundmatu platvorm'; end if;
 insert into public.streamers(name,platform,channel_url,game,avatar_url)
 values(trim(p_name),p_platform,trim(p_channel_url),nullif(trim(coalesce(p_game,'')),''),nullif(trim(coalesce(p_avatar_url,'')),''))
 returning * into r;
 return r;
end $$;

grant execute on function public.admin_add_streamer(text,text,text,text,text) to authenticated;

drop function if exists public.sync_streamer_status(uuid,boolean,integer,text,text,text);
drop function if exists public.sync_streamer_status(uuid,boolean,integer,text,text,text,text);

create or replace function public.sync_streamer_status(
 p_id uuid,p_is_live boolean,p_viewers integer,p_game text default null,
 p_thumbnail_url text default null,p_live_video_id text default null,p_error text default null
) returns public.streamers
language plpgsql security definer set search_path=public as $$
declare r public.streamers;
begin
 update public.streamers set
   is_live=case when manual_live then true else coalesce(p_is_live,false) end,
   viewers=case when manual_live and coalesce(p_viewers,0)=0 then greatest(manual_viewers,0) else greatest(coalesce(p_viewers,0),0) end,
   game=case when p_game is not null and trim(p_game)<>'' then trim(p_game) else game end,
   thumbnail_url=case when p_thumbnail_url is not null and trim(p_thumbnail_url)<>'' then p_thumbnail_url else thumbnail_url end,
   live_video_id=case when p_is_live then nullif(trim(coalesce(p_live_video_id,'')),'') else null end,
   sync_error=p_error,last_checked_at=now(),
   last_live_at=case when p_is_live then now() else last_live_at end,updated_at=now()
 where id=p_id returning * into r;
 if r.id is null then raise exception 'Striimerit ei leitud'; end if;
 return r;
end $$;

revoke all on function public.sync_streamer_status(uuid,boolean,integer,text,text,text,text) from public,anon,authenticated;
grant execute on function public.sync_streamer_status(uuid,boolean,integer,text,text,text,text) to service_role;

create table if not exists public.streamer_applications(
 id uuid primary key default gen_random_uuid(),name text not null,platform text not null,
 channel_url text not null,email text not null,message text,status text not null default 'pending',
 created_at timestamptz not null default now()
);
alter table public.streamer_applications drop constraint if exists streamer_applications_platform_check;
alter table public.streamer_applications add constraint streamer_applications_platform_check check(platform in('Twitch','YouTube','Kick','TikTok'));
alter table public.streamer_applications drop constraint if exists streamer_applications_status_check;
alter table public.streamer_applications add constraint streamer_applications_status_check check(status in('pending','approved','rejected'));
alter table public.streamer_applications enable row level security;
grant insert on public.streamer_applications to anon,authenticated;
grant select,update,delete on public.streamer_applications to authenticated;
grant all on public.streamer_applications to service_role;
drop policy if exists "apps_public_insert" on public.streamer_applications;
drop policy if exists "apps_admin_read" on public.streamer_applications;
drop policy if exists "apps_admin_update" on public.streamer_applications;
drop policy if exists "apps_admin_delete" on public.streamer_applications;
create policy "apps_public_insert" on public.streamer_applications for insert to anon,authenticated with check(length(trim(name)) between 2 and 80 and length(trim(email)) between 5 and 254);
create policy "apps_admin_read" on public.streamer_applications for select to authenticated using(auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);
create policy "apps_admin_update" on public.streamer_applications for update to authenticated using(auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid) with check(auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);
create policy "apps_admin_delete" on public.streamer_applications for delete to authenticated using(auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);

select 'STREAMHUB V15 DATABASE READY' as status;

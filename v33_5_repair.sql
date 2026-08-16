-- STREAMHUB V33.5 DATABASE REPAIR
-- RUN THIS ENTIRE FILE ONCE IN SUPABASE SQL EDITOR.
-- This is additive: it does not delete users, applications or streamers.
-- Do not paste any extra text before or after this SQL.

alter table public.streamer_applications add column if not exists thumbnail_url text;
alter table public.streamer_applications add column if not exists approved_at timestamptz;
alter table public.streamer_applications add column if not exists approved_by uuid references auth.users(id);
alter table public.streamers add column if not exists thumbnail_url text;
alter table public.streamers add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.streamers add column if not exists owner_email text;

-- Public application RPC with thumbnail support. The old 7-argument RPC remains intact.
create or replace function public.submit_streamer_application(
  p_name text,
  p_email text,
  p_platform text,
  p_channel_url text,
  p_game text,
  p_avatar_url text,
  p_message text,
  p_thumbnail_url text
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
    (name,email,platform,channel_url,game,avatar_url,message,thumbnail_url,status,created_at,updated_at)
  values
    (trim(p_name),lower(trim(p_email)),p_platform,trim(p_channel_url),
     nullif(trim(coalesce(p_game,'')),''),
     nullif(trim(coalesce(p_avatar_url,'')),''),
     nullif(trim(coalesce(p_message,'')),''),
     nullif(trim(coalesce(p_thumbnail_url,'')),''),
     'pending',now(),now())
  returning id into new_id;

  return new_id;
end;
$$;
revoke all on function public.submit_streamer_application(text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_streamer_application(text,text,text,text,text,text,text,text) to anon,authenticated;

-- ADMIN APPROVE: creates streamer and carries thumbnail into streamer profile.
drop function if exists public.admin_approve_application(uuid);
create function public.admin_approve_application(p_application_id uuid)
returns public.streamer_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.streamer_applications;
  r public.streamer_applications;
begin
  if not public.is_admin() then raise exception 'Sul puuduvad adminiõigused'; end if;

  select * into a
  from public.streamer_applications
  where id = p_application_id
  for update;

  if not found then raise exception 'Taotlust ei leitud'; end if;
  if a.status <> 'pending' then raise exception 'Taotlus on juba töödeldud'; end if;

  insert into public.streamers
    (name,platform,channel_url,game,avatar_url,thumbnail_url,owner_email,is_live,viewers,manual_live,manual_viewers,updated_at)
  values
    (trim(a.name),a.platform,trim(a.channel_url),nullif(trim(coalesce(a.game,'')),''),
     nullif(trim(coalesce(a.avatar_url,'')),''),nullif(trim(coalesce(a.thumbnail_url,'')),''),
     lower(trim(a.email)),false,0,false,0,now());

  update public.streamer_applications
  set status='approved',approved_at=now(),approved_by=auth.uid(),reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now()
  where id=a.id
  returning * into r;

  return r;
end;
$$;
revoke all on function public.admin_approve_application(uuid) from public,anon,authenticated;
grant execute on function public.admin_approve_application(uuid) to authenticated;

-- ADMIN REJECT.
drop function if exists public.admin_reject_application(uuid);
create function public.admin_reject_application(p_application_id uuid)
returns public.streamer_applications
language plpgsql
security definer
set search_path = public
as $$
declare r public.streamer_applications;
begin
  if not public.is_admin() then raise exception 'Sul puuduvad adminiõigused'; end if;
  update public.streamer_applications
  set status='rejected',reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now()
  where id=p_application_id and status='pending'
  returning * into r;
  if r.id is null then raise exception 'Taotlust ei leitud või see on juba töödeldud'; end if;
  return r;
end;
$$;
revoke all on function public.admin_reject_application(uuid) from public,anon,authenticated;
grant execute on function public.admin_reject_application(uuid) to authenticated;

-- ADMIN UPDATE.
drop function if exists public.admin_update_streamer(uuid,text,text,text,text);
create function public.admin_update_streamer(
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
  if not public.is_admin() then raise exception 'Sul puuduvad adminiõigused'; end if;
  if nullif(trim(coalesce(p_name,'')),'') is null then raise exception 'Nimi on kohustuslik'; end if;
  if nullif(trim(coalesce(p_channel_url,'')),'') is null then raise exception 'Kanali URL on kohustuslik'; end if;

  update public.streamers
  set name=trim(p_name),
      game=nullif(trim(coalesce(p_game,'')),''),
      thumbnail_url=nullif(trim(coalesce(p_thumbnail_url,'')),''),
      channel_url=trim(p_channel_url),
      updated_at=now()
  where id=p_streamer_id
  returning * into r;

  if r.id is null then raise exception 'Striimerit ei leitud'; end if;
  return r;
end;
$$;
revoke all on function public.admin_update_streamer(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.admin_update_streamer(uuid,text,text,text,text) to authenticated;

-- ADMIN DELETE.
drop function if exists public.admin_delete_streamer(uuid);
create function public.admin_delete_streamer(p_streamer_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Sul puuduvad adminiõigused'; end if;
  delete from public.streamers where id=p_streamer_id;
  return found;
end;
$$;
revoke all on function public.admin_delete_streamer(uuid) from public,anon,authenticated;
grant execute on function public.admin_delete_streamer(uuid) to authenticated;

-- Restore thumbnails for already-approved applications that predate this repair.
update public.streamers s
set thumbnail_url=nullif(trim(a.thumbnail_url),''),updated_at=now()
from public.streamer_applications a
where a.status='approved'
  and lower(trim(s.owner_email))=lower(trim(a.email))
  and nullif(trim(a.thumbnail_url),'') is not null
  and (s.thumbnail_url is null or trim(s.thumbnail_url)='');

-- Make sure only admin can directly update/delete streamer rows.
alter table public.streamers enable row level security;
drop policy if exists "streamhub_streamers_owner_update" on public.streamers;
drop policy if exists "streamers_owner_update_v302" on public.streamers;
drop policy if exists "Streamer can update own row" on public.streamers;
drop policy if exists "streamhub_streamers_admin_update" on public.streamers;
drop policy if exists "streamhub_streamers_admin_delete" on public.streamers;
create policy "streamhub_streamers_admin_update" on public.streamers for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "streamhub_streamers_admin_delete" on public.streamers for delete to authenticated using ((select public.is_admin()));

grant select on public.streamers to anon,authenticated;

-- Refresh PostgREST schema cache after the RPC changes.
notify pgrst, 'reload schema';
select pg_notification_queue_usage();

-- Verification. Every *_ready value must be true.
select
  'STREAMHUB V33.5 READY' as status,
  to_regprocedure('public.admin_approve_application(uuid)') is not null as approve_ready,
  to_regprocedure('public.admin_reject_application(uuid)') is not null as reject_ready,
  to_regprocedure('public.admin_update_streamer(uuid,text,text,text,text)') is not null as update_ready,
  to_regprocedure('public.admin_delete_streamer(uuid)') is not null as delete_ready,
  to_regprocedure('public.submit_streamer_application(text,text,text,text,text,text,text,text)') is not null as submit_thumbnail_ready,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='streamers' and column_name='thumbnail_url') as thumbnail_ready;

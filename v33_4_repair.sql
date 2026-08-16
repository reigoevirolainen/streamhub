-- STREAMHUB V33.4 DATABASE REPAIR
-- Run this ONCE in Supabase SQL Editor. It does not delete users, applications or streamers.

-- Ensure approval metadata columns exist.
alter table public.streamer_applications add column if not exists approved_at timestamptz;
alter table public.streamer_applications add column if not exists approved_by uuid references auth.users(id);
alter table public.streamers add column if not exists thumbnail_url text;
alter table public.streamers add column if not exists owner_id uuid references auth.users(id) on delete set null;

-- 1) ADMIN APPROVE: creates the streamer and COPIES thumbnail_url.
create or replace function public.admin_approve_application(p_application_id uuid)
returns public.streamer_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.streamer_applications;
  r public.streamer_applications;
begin
  if not public.is_admin() then
    raise exception 'Sul puuduvad adminiõigused';
  end if;

  select * into a
  from public.streamer_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Taotlust ei leitud';
  end if;

  if a.status <> 'pending' then
    raise exception 'Taotlus on juba töödeldud';
  end if;

  insert into public.streamers (
    name, platform, channel_url, game, avatar_url, thumbnail_url,
    owner_email, is_live, viewers, manual_live, manual_viewers, updated_at
  ) values (
    trim(a.name), a.platform, trim(a.channel_url), nullif(trim(coalesce(a.game,'')), ''),
    nullif(trim(coalesce(a.avatar_url,'')), ''),
    nullif(trim(coalesce(a.thumbnail_url,'')), ''),
    lower(trim(a.email)), false, 0, false, 0, now()
  );

  update public.streamer_applications
  set status = 'approved',
      approved_at = now(),
      approved_by = auth.uid(),
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      updated_at = now()
  where id = a.id
  returning * into r;

  return r;
end;
$$;

revoke all on function public.admin_approve_application(uuid) from public, anon, authenticated;
grant execute on function public.admin_approve_application(uuid) to authenticated;

-- Backfill thumbnails for streamers that were approved before V33.4
-- and therefore may have a NULL thumbnail_url.
update public.streamers s
set thumbnail_url = nullif(trim(a.thumbnail_url), ''),
    updated_at = now()
from public.streamer_applications a
where s.thumbnail_url is null
  and a.status = 'approved'
  and nullif(trim(a.thumbnail_url), '') is not null
  and lower(trim(s.owner_email)) = lower(trim(a.email));

-- 2) ADMIN REJECT.
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
  set status='rejected', reviewed_at=now(), reviewed_by=auth.uid(), updated_at=now()
  where id=p_application_id and status='pending'
  returning * into r;

  if r.id is null then
    raise exception 'Taotlust ei leitud või see on juba töödeldud';
  end if;
  return r;
end;
$$;

revoke all on function public.admin_reject_application(uuid) from public, anon, authenticated;
grant execute on function public.admin_reject_application(uuid) to authenticated;

-- 3) ADMIN UPDATE.
create or replace function public.admin_update_streamer(
  p_streamer_id uuid, p_name text, p_game text, p_thumbnail_url text, p_channel_url text
)
returns public.streamers
language plpgsql
security definer
set search_path = public
as $$
declare r public.streamers;
begin
  if not public.is_admin() then raise exception 'Sul puuduvad adminiõigused'; end if;
  if p_streamer_id is null then raise exception 'Striimeri ID puudub'; end if;
  if nullif(trim(coalesce(p_name,'')), '') is null then raise exception 'Nimi on kohustuslik'; end if;
  if nullif(trim(coalesce(p_channel_url,'')), '') is null then raise exception 'Kanali URL on kohustuslik'; end if;

  update public.streamers
  set name=trim(p_name),
      game=nullif(trim(coalesce(p_game,'')), ''),
      thumbnail_url=nullif(trim(coalesce(p_thumbnail_url,'')), ''),
      channel_url=trim(p_channel_url),
      updated_at=now()
  where id=p_streamer_id
  returning * into r;

  if r.id is null then raise exception 'Striimerit ei leitud'; end if;
  return r;
end;
$$;

revoke all on function public.admin_update_streamer(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.admin_update_streamer(uuid,text,text,text,text) to authenticated;

-- 4) ADMIN DELETE.
create or replace function public.admin_delete_streamer(p_streamer_id uuid)
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

revoke all on function public.admin_delete_streamer(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_streamer(uuid) to authenticated;

-- Force PostgREST to reload its schema cache.
notify pgrst, 'reload schema';

-- FINAL CHECK: every value below should be true.
select
  'STREAMHUB V33.4 READY' as status,
  to_regprocedure('public.admin_approve_application(uuid)') is not null as approve_ready,
  to_regprocedure('public.admin_reject_application(uuid)') is not null as reject_ready,
  to_regprocedure('public.admin_update_streamer(uuid,text,text,text,text)') is not null as update_ready,
  to_regprocedure('public.admin_delete_streamer(uuid)') is not null as delete_ready,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='streamers' and column_name='thumbnail_url') as thumbnail_ready;

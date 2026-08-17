-- ============================================================
-- STREAMHUB V40 DATABASE
-- Idempotent repair/upgrade for the existing StreamHub database.
-- DOES NOT DELETE auth.users, profiles, applications or streamers.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  email text,
  display_name text,
  avatar_url text,
  user_type text not null default 'streamer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists user_type text default 'streamer';
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();

update public.profiles set user_type='streamer' where user_type is null;
alter table public.profiles drop constraint if exists profiles_user_type_check;
alter table public.profiles add constraint profiles_user_type_check check(user_type in ('streamer','admin'));

-- ---------- streamer applications ----------
create table if not exists public.streamer_applications (
  id uuid primary key default gen_random_uuid(),
  name text, email text, platform text, channel_url text, game text,
  avatar_url text, thumbnail_url text, message text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);
alter table public.streamer_applications add column if not exists name text;
alter table public.streamer_applications add column if not exists email text;
alter table public.streamer_applications add column if not exists platform text;
alter table public.streamer_applications add column if not exists channel_url text;
alter table public.streamer_applications add column if not exists game text;
alter table public.streamer_applications add column if not exists avatar_url text;
alter table public.streamer_applications add column if not exists thumbnail_url text;
alter table public.streamer_applications add column if not exists message text;
alter table public.streamer_applications add column if not exists status text default 'pending';
alter table public.streamer_applications add column if not exists created_at timestamptz default now();
alter table public.streamer_applications add column if not exists updated_at timestamptz default now();
alter table public.streamer_applications add column if not exists approved_at timestamptz;
alter table public.streamer_applications add column if not exists approved_by uuid;
alter table public.streamer_applications add column if not exists reviewed_at timestamptz;
alter table public.streamer_applications add column if not exists reviewed_by uuid;
update public.streamer_applications set status='pending' where status is null;
alter table public.streamer_applications drop constraint if exists streamer_applications_platform_check;
alter table public.streamer_applications add constraint streamer_applications_platform_check check(platform is null or platform in ('Twitch','YouTube','Kick','TikTok'));
alter table public.streamer_applications drop constraint if exists streamer_applications_status_check;
alter table public.streamer_applications add constraint streamer_applications_status_check check(status in ('pending','approved','rejected'));

-- ---------- streamers ----------
create table if not exists public.streamers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  platform text,
  channel_url text,
  game text,
  avatar_url text,
  thumbnail_url text,
  owner_id uuid,
  owner_email text,
  is_live boolean not null default false,
  viewers integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.streamers add column if not exists name text;
alter table public.streamers add column if not exists platform text;
alter table public.streamers add column if not exists channel_url text;
alter table public.streamers add column if not exists game text;
alter table public.streamers add column if not exists avatar_url text;
alter table public.streamers add column if not exists thumbnail_url text;
alter table public.streamers add column if not exists owner_id uuid;
alter table public.streamers add column if not exists owner_email text;
alter table public.streamers add column if not exists is_live boolean default false;
alter table public.streamers add column if not exists viewers integer default 0;
alter table public.streamers add column if not exists created_at timestamptz default now();
alter table public.streamers add column if not exists updated_at timestamptz default now();
update public.streamers set is_live=false where is_live is null;
update public.streamers set viewers=0 where viewers is null;
update public.streamers set updated_at=now() where updated_at is null;
alter table public.streamers drop constraint if exists streamers_viewers_nonnegative_check;
alter table public.streamers add constraint streamers_viewers_nonnegative_check check(viewers >= 0);

-- ---------- automatic profile ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  insert into public.profiles(id,username,email,display_name,avatar_url,user_type)
  values(
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'username',''),split_part(coalesce(new.email,''),'@',1)),
    new.email,
    nullif(new.raw_user_meta_data->>'display_name',''),
    nullif(new.raw_user_meta_data->>'avatar_url',''),
    'streamer'
  )
  on conflict(id) do update set email=coalesce(public.profiles.email,excluded.email);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- admin ----------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and user_type='admin') $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ---------- timestamps ----------
create or replace function public.streamhub_touch()
returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.streamhub_touch();
drop trigger if exists streamers_updated_at on public.streamers;
create trigger streamers_updated_at before update on public.streamers for each row execute function public.streamhub_touch();
drop trigger if exists applications_updated_at on public.streamer_applications;
create trigger applications_updated_at before update on public.streamer_applications for each row execute function public.streamhub_touch();

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.streamer_applications enable row level security;
alter table public.streamers enable row level security;

drop policy if exists "v40_public_streamers" on public.streamers;
create policy "v40_public_streamers" on public.streamers for select to anon,authenticated using(true);

drop policy if exists "v40_public_profiles" on public.profiles;
create policy "v40_public_profiles" on public.profiles for select to anon,authenticated using(true);

drop policy if exists "v40_admin_apps_select" on public.streamer_applications;
create policy "v40_admin_apps_select" on public.streamer_applications for select to authenticated using(public.is_admin());

drop policy if exists "v40_owner_apps_select" on public.streamer_applications;
create policy "v40_owner_apps_select" on public.streamer_applications for select to authenticated using(lower(trim(email))=lower(coalesce(auth.jwt()->>'email','')) or public.is_admin());

drop policy if exists "v40_admin_apps_update" on public.streamer_applications;
create policy "v40_admin_apps_update" on public.streamer_applications for update to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists "v40_owner_streamer_update" on public.streamers;
create policy "v40_owner_streamer_update" on public.streamers for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());

drop policy if exists "v40_admin_streamer_update" on public.streamers;
create policy "v40_admin_streamer_update" on public.streamers for update to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists "v40_admin_streamer_delete" on public.streamers;
create policy "v40_admin_streamer_delete" on public.streamers for delete to authenticated using(public.is_admin());

-- ---------- permissions ----------
grant usage on schema public to anon,authenticated;
grant select on public.streamers to anon,authenticated;
grant select on public.profiles to anon,authenticated;
grant select on public.streamer_applications to authenticated;

-- ---------- public application ----------
create or replace function public.submit_streamer_application(
 p_name text,p_email text,p_platform text,p_channel_url text,
 p_game text default null,p_avatar_url text default null,
 p_message text default null,p_thumbnail_url text default null
) returns uuid language plpgsql security definer set search_path=public
as $$
declare new_id uuid;
begin
 if nullif(trim(p_name),'') is null then raise exception 'Striimeri nimi on kohustuslik'; end if;
 if nullif(trim(p_email),'') is null then raise exception 'E-post on kohustuslik'; end if;
 if p_platform not in ('Twitch','YouTube','Kick','TikTok') then raise exception 'Tundmatu platvorm'; end if;
 if nullif(trim(p_channel_url),'') is null then raise exception 'Kanali URL on kohustuslik'; end if;
 insert into public.streamer_applications(name,email,platform,channel_url,game,avatar_url,message,thumbnail_url,status)
 values(trim(p_name),lower(trim(p_email)),p_platform,trim(p_channel_url),
 nullif(trim(p_game),''),nullif(trim(p_avatar_url),''),nullif(trim(p_message),''),nullif(trim(p_thumbnail_url),''),'pending')
 returning id into new_id;
 return new_id;
end $$;
revoke all on function public.submit_streamer_application(text,text,text,text,text,text,text,text) from public;
grant execute on function public.submit_streamer_application(text,text,text,text,text,text,text,text) to anon,authenticated;

-- ---------- admin approve ----------
drop function if exists public.admin_approve_application(uuid);
create function public.admin_approve_application(p_application_id uuid)
returns public.streamer_applications language plpgsql security definer set search_path=public
as $$
declare a public.streamer_applications; existing_id uuid; matched_owner uuid; result_row public.streamer_applications;
begin
 if not public.is_admin() then raise exception 'Sul puuduvad adminiõigused'; end if;
 select * into a from public.streamer_applications where id=p_application_id for update;
 if not found then raise exception 'Taotlust ei leitud'; end if;
 if a.status<>'pending' then raise exception 'Taotlus on juba töödeldud'; end if;

 select u.id into matched_owner from auth.users u where lower(u.email)=lower(trim(a.email)) order by u.created_at asc limit 1;
 select s.id into existing_id from public.streamers s
 where (matched_owner is not null and s.owner_id=matched_owner)
    or lower(trim(coalesce(s.owner_email,'')))=lower(trim(a.email))
 order by s.created_at asc limit 1;

 if existing_id is null then
   insert into public.streamers(name,platform,channel_url,game,avatar_url,thumbnail_url,owner_id,owner_email,is_live,viewers)
   values(trim(a.name),a.platform,trim(a.channel_url),nullif(trim(a.game),''),nullif(trim(a.avatar_url),''),nullif(trim(a.thumbnail_url),''),matched_owner,lower(trim(a.email)),false,0);
 else
   update public.streamers set
     name=trim(a.name),platform=a.platform,channel_url=trim(a.channel_url),
     game=nullif(trim(a.game),''),avatar_url=nullif(trim(a.avatar_url),''),
     thumbnail_url=coalesce(nullif(trim(a.thumbnail_url),''),thumbnail_url),
     owner_id=coalesce(owner_id,matched_owner),owner_email=lower(trim(a.email))
   where id=existing_id;
 end if;

 update public.streamer_applications set status='approved',approved_at=now(),approved_by=auth.uid(),reviewed_at=now(),reviewed_by=auth.uid()
 where id=a.id returning * into result_row;
 return result_row;
end $$;
revoke all on function public.admin_approve_application(uuid) from public,anon,authenticated;
grant execute on function public.admin_approve_application(uuid) to authenticated;

-- ---------- admin reject ----------
drop function if exists public.admin_reject_application(uuid);
create function public.admin_reject_application(p_application_id uuid)
returns public.streamer_applications language plpgsql security definer set search_path=public
as $$
declare r public.streamer_applications;
begin
 if not public.is_admin() then raise exception 'Sul puuduvad adminiõigused'; end if;
 update public.streamer_applications set status='rejected',reviewed_at=now(),reviewed_by=auth.uid()
 where id=p_application_id and status='pending' returning * into r;
 if r.id is null then raise exception 'Taotlust ei leitud või see on juba töödeldud'; end if;
 return r;
end $$;
revoke all on function public.admin_reject_application(uuid) from public,anon,authenticated;
grant execute on function public.admin_reject_application(uuid) to authenticated;

-- ---------- admin edit/delete ----------
drop function if exists public.admin_update_streamer(uuid,text,text,text,text);
create function public.admin_update_streamer(p_streamer_id uuid,p_name text,p_game text,p_thumbnail_url text,p_channel_url text)
returns public.streamers language plpgsql security definer set search_path=public
as $$
declare r public.streamers;
begin
 if not public.is_admin() then raise exception 'Sul puuduvad adminiõigused'; end if;
 update public.streamers set name=trim(p_name),game=nullif(trim(coalesce(p_game,'')),''),thumbnail_url=nullif(trim(coalesce(p_thumbnail_url,'')),''),channel_url=trim(p_channel_url)
 where id=p_streamer_id returning * into r;
 if r.id is null then raise exception 'Striimerit ei leitud'; end if;
 return r;
end $$;
revoke all on function public.admin_update_streamer(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.admin_update_streamer(uuid,text,text,text,text) to authenticated;

drop function if exists public.admin_delete_streamer(uuid);
create function public.admin_delete_streamer(p_streamer_id uuid)
returns boolean language plpgsql security definer set search_path=public
as $$
begin
 if not public.is_admin() then raise exception 'Sul puuduvad adminiõigused'; end if;
 delete from public.streamers where id=p_streamer_id;
 return found;
end $$;
revoke all on function public.admin_delete_streamer(uuid) from public,anon,authenticated;
grant execute on function public.admin_delete_streamer(uuid) to authenticated;

-- ---------- claim ----------
create or replace function public.claim_my_streamer()
returns public.streamers language plpgsql security definer set search_path=public
as $$
declare r public.streamers; e text;
begin
 if auth.uid() is null then raise exception 'Logi sisse'; end if;
 select lower(trim(email)) into e from auth.users where id=auth.uid();
 update public.streamers set owner_id=auth.uid(),owner_email=e
 where owner_id is null and lower(trim(coalesce(owner_email,'')))=e
 returning * into r;
 if r.id is null then raise exception 'Kinnitatud striimeriprofiili ei leitud'; end if;
 return r;
end $$;
revoke all on function public.claim_my_streamer() from public,anon;
grant execute on function public.claim_my_streamer() to authenticated;

-- ---------- streamer live toggle ----------
drop function if exists public.set_my_stream_live(boolean);
create function public.set_my_stream_live(p_is_live boolean)
returns public.streamers language plpgsql security definer set search_path=public
as $$
declare r public.streamers;
begin
 if auth.uid() is null then raise exception 'Logi sisse'; end if;
 update public.streamers set is_live=p_is_live,viewers=case when p_is_live then viewers else 0 end
 where owner_id=auth.uid() returning * into r;
 if r.id is null then raise exception 'Sinu kontoga seotud striimeriprofiili ei leitud'; end if;
 return r;
end $$;
revoke all on function public.set_my_stream_live(boolean) from public,anon;
grant execute on function public.set_my_stream_live(boolean) to authenticated;

-- ---------- indexes ----------
create index if not exists streamhub_v40_streamers_game_idx on public.streamers(game);
create index if not exists streamhub_v40_streamers_platform_idx on public.streamers(platform);
create index if not exists streamhub_v40_streamers_live_idx on public.streamers(is_live);
create index if not exists streamhub_v40_streamers_owner_idx on public.streamers(owner_id);
create index if not exists streamhub_v40_apps_status_idx on public.streamer_applications(status);

notify pgrst,'reload schema';

select
 'STREAMHUB V40 READY' as status,
 to_regprocedure('public.submit_streamer_application(text,text,text,text,text,text,text,text)') is not null as application_ready,
 to_regprocedure('public.admin_approve_application(uuid)') is not null as approve_ready,
 to_regprocedure('public.admin_reject_application(uuid)') is not null as reject_ready,
 to_regprocedure('public.admin_update_streamer(uuid,text,text,text,text)') is not null as update_ready,
 to_regprocedure('public.admin_delete_streamer(uuid)') is not null as delete_ready,
 to_regprocedure('public.claim_my_streamer()') is not null as claim_ready,
 to_regprocedure('public.set_my_stream_live(boolean)') is not null as live_ready;

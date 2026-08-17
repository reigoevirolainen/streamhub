-- ============================================================
-- STREAMHUB V37 FINAL DATABASE
-- ============================================================
-- Purpose:
--   StreamHub streamer platform
--   - Public streamer applications
--   - Admin approval / rejection
--   - Streamer profiles
--   - Login support
--   - Live/offline status
--   - Featured games
--   - Platform filtering
--   - Thumbnail / avatar URLs
--   - Password ciphertext storage for workflow
--
-- IMPORTANT:
--   This migration is designed to be SAFE on an existing database.
--   It does NOT DROP USERS.
--   It does NOT DROP TABLES.
--   It does NOT delete existing streamer data.
--
-- ============================================================


-- ============================================================
-- 0. EXTENSIONS
-- ============================================================

create extension if not exists pgcrypto;


-- ============================================================
-- 1. PROFILES
-- ============================================================

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text,
    username text,
    display_name text,
    avatar_url text,
    role text not null default 'user',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


-- Add missing profile columns safely
alter table public.profiles
    add column if not exists email text;

alter table public.profiles
    add column if not exists username text;

alter table public.profiles
    add column if not exists display_name text;

alter table public.profiles
    add column if not exists avatar_url text;

alter table public.profiles
    add column if not exists role text default 'user';

alter table public.profiles
    add column if not exists created_at timestamptz default now();

alter table public.profiles
    add column if not exists updated_at timestamptz default now();


-- ============================================================
-- 2. STREAMER APPLICATIONS
-- ============================================================

create table if not exists public.streamer_applications (
    id uuid primary key default gen_random_uuid(),

    name text not null,
    email text not null,

    -- Password workflow
    password_ciphertext text,

    -- Compatibility fields
    password_hash text,

    platform text not null default 'Twitch',
    channel_url text not null,

    game text,
    thumbnail_url text,
    avatar_url text,

    message text,

    status text not null default 'pending',

    approved_at timestamptz,
    rejected_at timestamptz,
    reviewed_at timestamptz,

    approved_by uuid references auth.users(id) on delete set null,
    reviewed_by uuid references auth.users(id) on delete set null,

    rejection_reason text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


-- ============================================================
-- 3. ADD / REPAIR APPLICATION COLUMNS
-- ============================================================

alter table public.streamer_applications
    add column if not exists name text;

alter table public.streamer_applications
    add column if not exists email text;

alter table public.streamer_applications
    add column if not exists password_ciphertext text;

alter table public.streamer_applications
    add column if not exists password_hash text;

alter table public.streamer_applications
    add column if not exists platform text default 'Twitch';

alter table public.streamer_applications
    add column if not exists channel_url text;

alter table public.streamer_applications
    add column if not exists game text;

alter table public.streamer_applications
    add column if not exists thumbnail_url text;

alter table public.streamer_applications
    add column if not exists avatar_url text;

alter table public.streamer_applications
    add column if not exists message text;

alter table public.streamer_applications
    add column if not exists status text default 'pending';

alter table public.streamer_applications
    add column if not exists approved_at timestamptz;

alter table public.streamer_applications
    add column if not exists rejected_at timestamptz;

alter table public.streamer_applications
    add column if not exists reviewed_at timestamptz;

alter table public.streamer_applications
    add column if not exists approved_by uuid;

alter table public.streamer_applications
    add column if not exists reviewed_by uuid;

alter table public.streamer_applications
    add column if not exists rejection_reason text;

alter table public.streamer_applications
    add column if not exists created_at timestamptz default now();

alter table public.streamer_applications
    add column if not exists updated_at timestamptz default now();


-- ============================================================
-- 4. STREAMERS
-- ============================================================

create table if not exists public.streamers (
    id uuid primary key default gen_random_uuid(),

    user_id uuid references auth.users(id) on delete cascade,

    application_id uuid references public.streamer_applications(id)
        on delete set null,

    email text,
    name text,
    username text,
    display_name text,

    platform text not null default 'Twitch',
    channel_url text not null,

    game text,

    thumbnail_url text,
    avatar_url text,

    description text,

    is_live boolean not null default false,

    -- Compatibility with existing frontend / old versions
    manual_live boolean not null default false,

    live_status boolean not null default false,

    enabled boolean not null default true,

    featured boolean not null default false,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    last_live_at timestamptz
);


-- ============================================================
-- 5. REPAIR STREAMERS TABLE
-- ============================================================

alter table public.streamers
    add column if not exists user_id uuid;

alter table public.streamers
    add column if not exists application_id uuid;

alter table public.streamers
    add column if not exists email text;

alter table public.streamers
    add column if not exists name text;

alter table public.streamers
    add column if not exists username text;

alter table public.streamers
    add column if not exists display_name text;

alter table public.streamers
    add column if not exists platform text default 'Twitch';

alter table public.streamers
    add column if not exists channel_url text;

alter table public.streamers
    add column if not exists game text;

alter table public.streamers
    add column if not exists thumbnail_url text;

alter table public.streamers
    add column if not exists avatar_url text;

alter table public.streamers
    add column if not exists description text;

alter table public.streamers
    add column if not exists is_live boolean default false;

alter table public.streamers
    add column if not exists manual_live boolean default false;

alter table public.streamers
    add column if not exists live_status boolean default false;

alter table public.streamers
    add column if not exists enabled boolean default true;

alter table public.streamers
    add column if not exists featured boolean default false;

alter table public.streamers
    add column if not exists created_at timestamptz default now();

alter table public.streamers
    add column if not exists updated_at timestamptz default now();

alter table public.streamers
    add column if not exists last_live_at timestamptz;


-- ============================================================
-- 6. GAMES
-- ============================================================

create table if not exists public.games (
    id uuid primary key default gen_random_uuid(),

    name text not null,
    slug text unique,
    image_url text,
    thumbnail_url text,

    description text,

    featured boolean not null default false,
    enabled boolean not null default true,

    sort_order integer not null default 0,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


-- ============================================================
-- 7. REPAIR GAMES TABLE
-- ============================================================

alter table public.games
    add column if not exists name text;

alter table public.games
    add column if not exists slug text;

alter table public.games
    add column if not exists image_url text;

alter table public.games
    add column if not exists thumbnail_url text;

alter table public.games
    add column if not exists description text;

alter table public.games
    add column if not exists featured boolean default false;

alter table public.games
    add column if not exists enabled boolean default true;

alter table public.games
    add column if not exists sort_order integer default 0;

alter table public.games
    add column if not exists created_at timestamptz default now();

alter table public.games
    add column if not exists updated_at timestamptz default now();


-- ============================================================
-- 8. GAME DATA
-- ============================================================
-- Only insert if the game does not already exist.
-- These are public image URLs and can be replaced later
-- from the admin/game management system.
-- ============================================================

insert into public.games
    (name, slug, image_url, thumbnail_url, featured, enabled, sort_order)
select
    'Fortnite',
    'fortnite',
    'https://cdn2.unrealengine.com/fortnite-battle-royale-1920x1080-1a1f5e7b6e1b.jpg',
    'https://cdn2.unrealengine.com/fortnite-battle-royale-1920x1080-1a1f5e7b6e1b.jpg',
    true,
    true,
    1
where not exists (
    select 1 from public.games where lower(name) = 'fortnite'
);


insert into public.games
    (name, slug, image_url, thumbnail_url, featured, enabled, sort_order)
select
    'Minecraft',
    'minecraft',
    'https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/key-art/Minecraft_JE_1920x1080.jpg',
    'https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/key-art/Minecraft_JE_1920x1080.jpg',
    true,
    true,
    2
where not exists (
    select 1 from public.games where lower(name) = 'minecraft'
);


insert into public.games
    (name, slug, image_url, thumbnail_url, featured, enabled, sort_order)
select
    'Call of Duty: Warzone',
    'warzone',
    'https://cdn.mos.cms.futurecdn.net/warzone.jpg',
    'https://cdn.mos.cms.futurecdn.net/warzone.jpg',
    true,
    true,
    3
where not exists (
    select 1 from public.games where lower(name) = 'call of duty: warzone'
);


insert into public.games
    (name, slug, image_url, thumbnail_url, featured, enabled, sort_order)
select
    'Apex Legends',
    'apex-legends',
    'https://media.contentapi.ea.com/content/dam/apex-legends/common/articles/apex-legends.jpg',
    'https://media.contentapi.ea.com/content/dam/apex-legends/common/articles/apex-legends.jpg',
    true,
    true,
    4
where not exists (
    select 1 from public.games where lower(name) = 'apex legends'
);


insert into public.games
    (name, slug, image_url, thumbnail_url, featured, enabled, sort_order)
select
    'Grand Theft Auto V',
    'gta-v',
    'https://media-rockstargames-com.akamaized.net/mfe6/prod/6c3f0d7c1c3e5f3c1f5b.jpg',
    'https://media-rockstargames-com.akamaized.net/mfe6/prod/6c3f0d7c1c3e5f3c1f5b.jpg',
    true,
    true,
    5
where not exists (
    select 1 from public.games where lower(name) = 'grand theft auto v'
);


insert into public.games
    (name, slug, image_url, thumbnail_url, featured, enabled, sort_order)
select
    'VALORANT',
    'valorant',
    'https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/blt.jpg',
    'https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/blt.jpg',
    true,
    true,
    6
where not exists (
    select 1 from public.games where lower(name) = 'valorant'
);


-- ============================================================
-- 9. INDEXES
-- ============================================================

create index if not exists idx_streamer_applications_status
on public.streamer_applications(status);

create index if not exists idx_streamer_applications_email
on public.streamer_applications(lower(email));

create index if not exists idx_streamer_applications_created_at
on public.streamer_applications(created_at desc);

create index if not exists idx_streamers_live
on public.streamers(is_live);

create index if not exists idx_streamers_manual_live
on public.streamers(manual_live);

create index if not exists idx_streamers_platform
on public.streamers(platform);

create index if not exists idx_streamers_game
on public.streamers(game);

create index if not exists idx_streamers_enabled
on public.streamers(enabled);

create index if not exists idx_games_featured
on public.games(featured);

create index if not exists idx_games_sort
on public.games(sort_order);


-- ============================================================
-- 10. UPDATED_AT FUNCTION
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;


-- ============================================================
-- 11. UPDATED_AT TRIGGERS
-- ============================================================

drop trigger if exists trg_profiles_updated_at
on public.profiles;

create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();


drop trigger if exists trg_streamer_applications_updated_at
on public.streamer_applications;

create trigger trg_streamer_applications_updated_at
before update on public.streamer_applications
for each row
execute function public.set_updated_at();


drop trigger if exists trg_streamers_updated_at
on public.streamers;

create trigger trg_streamers_updated_at
before update on public.streamers
for each row
execute function public.set_updated_at();


drop trigger if exists trg_games_updated_at
on public.games;

create trigger trg_games_updated_at
before update on public.games
for each row
execute function public.set_updated_at();


-- ============================================================
-- 12. ADMIN CHECK FUNCTION
-- ============================================================

create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    current_role text;
begin

    select role
    into current_role
    from public.profiles
    where id = auth.uid();

    return coalesce(current_role = 'admin', false);

end;
$$;


-- ============================================================
-- 13. ADMIN CHECK BY USER ID
-- ============================================================

create or replace function public.is_admin_user(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    current_role text;
begin

    select role
    into current_role
    from public.profiles
    where id = p_user_id;

    return coalesce(current_role = 'admin', false);

end;
$$;


-- ============================================================
-- 14. HANDLE NEW AUTH USER
-- ============================================================
-- Creates profile automatically after Supabase Auth user creation.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

    insert into public.profiles (
        id,
        email,
        username,
        display_name,
        role
    )
    values (
        new.id,
        new.email,
        coalesce(
            new.raw_user_meta_data ->> 'username',
            split_part(coalesce(new.email, ''), '@', 1)
        ),
        coalesce(
            new.raw_user_meta_data ->> 'display_name',
            split_part(coalesce(new.email, ''), '@', 1)
        ),
        'user'
    )
    on conflict (id) do update
    set
        email = excluded.email,
        username = coalesce(
            public.profiles.username,
            excluded.username
        ),
        display_name = coalesce(
            public.profiles.display_name,
            excluded.display_name
        );

    return new;

end;
$$;


-- ============================================================
-- 15. AUTH USER TRIGGER
-- ============================================================

drop trigger if exists on_auth_user_created
on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();


-- ============================================================
-- 16. ADMIN USER
-- ============================================================
-- Existing admin UUID from the current StreamHub setup.
--
-- If this UUID exists in auth.users, it becomes admin.
-- If it does not exist, this does nothing.
-- ============================================================

update public.profiles
set
    role = 'admin',
    updated_at = now()
where id = '56a4036e-b37d-4928-abf2-8f49d709f5b7';


-- ============================================================
-- 17. ADMIN APPLICATION APPROVAL
-- ============================================================
-- Approves an application and creates / updates streamer record.
--
-- The Edge Function can also perform this workflow directly.
-- This function exists as a database-safe fallback.
-- ============================================================

create or replace function public.admin_approve_application(
    p_application_id uuid
)
returns public.streamer_applications
language plpgsql
security definer
set search_path = public
as $$
declare
    a public.streamer_applications;
    s public.streamers;
begin

    if not public.is_admin() then
        raise exception 'Sul puudub adminiõigus';
    end if;

    select *
    into a
    from public.streamer_applications
    where id = p_application_id
    for update;

    if not found then
        raise exception 'Taotlust ei leitud';
    end if;

    if a.status = 'approved' then
        return a;
    end if;

    update public.streamer_applications
    set
        status = 'approved',
        approved_at = now(),
        reviewed_at = now(),
        approved_by = auth.uid(),
        reviewed_by = auth.uid(),
        updated_at = now()
    where id = p_application_id
    returning *
    into a;

    insert into public.streamers (
        application_id,
        email,
        name,
        username,
        display_name,
        platform,
        channel_url,
        game,
        thumbnail_url,
        avatar_url,
        description,
        is_live,
        manual_live,
        live_status,
        enabled,
        featured
    )
    values (
        a.id,
        a.email,
        a.name,
        split_part(a.email, '@', 1),
        a.name,
        a.platform,
        a.channel_url,
        a.game,
        a.thumbnail_url,
        a.avatar_url,
        a.message,
        false,
        false,
        false,
        true,
        false
    )
    on conflict do nothing;

    return a;

end;
$$;


-- ============================================================
-- 18. ADMIN REJECT APPLICATION
-- ============================================================

create or replace function public.admin_reject_application(
    p_application_id uuid,
    p_reason text default null
)
returns public.streamer_applications
language plpgsql
security definer
set search_path = public
as $$
declare
    a public.streamer_applications;
begin

    if not public.is_admin() then
        raise exception 'Sul puudub adminiõigus';
    end if;

    update public.streamer_applications
    set
        status = 'rejected',
        rejected_at = now(),
        reviewed_at = now(),
        reviewed_by = auth.uid(),
        rejection_reason = p_reason,
        updated_at = now()
    where id = p_application_id
    returning *
    into a;

    if not found then
        raise exception 'Taotlust ei leitud';
    end if;

    return a;

end;
$$;


-- ============================================================
-- 19. LIVE STATUS FUNCTION
-- ============================================================

create or replace function public.set_streamer_live_status(
    p_streamer_id uuid,
    p_live boolean
)
returns public.streamers
language plpgsql
security definer
set search_path = public
as $$
declare
    s public.streamers;
begin

    if not exists (
        select 1
        from public.streamers
        where id = p_streamer_id
    ) then
        raise exception 'Striimerit ei leitud';
    end if;

    update public.streamers
    set
        is_live = p_live,
        manual_live = p_live,
        live_status = p_live,
        last_live_at = case
            when p_live then now()
            else last_live_at
        end,
        updated_at = now()
    where id = p_streamer_id
    returning *
    into s;

    return s;

end;
$$;


-- ============================================================
-- 20. PUBLIC LIVE STREAMERS VIEW
-- ============================================================

create or replace view public.public_live_streamers
as
select
    id,
    name,
    username,
    display_name,
    platform,
    channel_url,
    game,
    thumbnail_url,
    avatar_url,
    description,
    is_live,
    manual_live,
    live_status
from public.streamers
where enabled = true
  and is_live = true;


-- ============================================================
-- 21. PUBLIC STREAMERS VIEW
-- ============================================================

create or replace view public.public_streamers
as
select
    id,
    name,
    username,
    display_name,
    platform,
    channel_url,
    game,
    thumbnail_url,
    avatar_url,
    description,
    is_live,
    manual_live,
    live_status,
    featured,
    created_at
from public.streamers
where enabled = true;


-- ============================================================
-- 22. PUBLIC FEATURED GAMES VIEW
-- ============================================================

create or replace view public.public_featured_games
as
select
    id,
    name,
    slug,
    image_url,
    thumbnail_url,
    description,
    sort_order
from public.games
where enabled = true
  and featured = true
order by sort_order asc, name asc;


-- ============================================================
-- 23. RLS
-- ============================================================

alter table public.profiles enable row level security;

alter table public.streamer_applications enable row level security;

alter table public.streamers enable row level security;

alter table public.games enable row level security;


-- ============================================================
-- 24. PROFILES POLICIES
-- ============================================================

drop policy if exists profiles_select_own
on public.profiles;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (
    id = auth.uid()
    or public.is_admin()
);


drop policy if exists profiles_update_own
on public.profiles;

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (
    id = auth.uid()
    or public.is_admin()
)
with check (
    id = auth.uid()
    or public.is_admin()
);


-- ============================================================
-- 25. APPLICATION POLICIES
-- ============================================================

drop policy if exists applications_admin_select
on public.streamer_applications;

create policy applications_admin_select
on public.streamer_applications
for select
to authenticated
using (
    public.is_admin()
);


drop policy if exists applications_admin_update
on public.streamer_applications;

create policy applications_admin_update
on public.streamer_applications
for update
to authenticated
using (
    public.is_admin()
)
with check (
    public.is_admin()
);


-- Public application creation.
-- The Edge Function is still the preferred route.
drop policy if exists applications_public_insert
on public.streamer_applications;

create policy applications_public_insert
on public.streamer_applications
for insert
to anon, authenticated
with check (
    status = 'pending'
);


-- ============================================================
-- 26. STREAMER POLICIES
-- ============================================================

drop policy if exists streamers_public_select
on public.streamers;

create policy streamers_public_select
on public.streamers
for select
to anon, authenticated
using (
    enabled = true
    or public.is_admin()
);


drop policy if exists streamers_admin_insert
on public.streamers;

create policy streamers_admin_insert
on public.streamers
for insert
to authenticated
with check (
    public.is_admin()
);


drop policy if exists streamers_admin_update
on public.streamers;

create policy streamers_admin_update
on public.streamers
for update
to authenticated
using (
    public.is_admin()
)
with check (
    public.is_admin()
);


drop policy if exists streamers_admin_delete
on public.streamers;

create policy streamers_admin_delete
on public.streamers
for delete
to authenticated
using (
    public.is_admin()
);


-- ============================================================
-- 27. GAMES POLICIES
-- ============================================================

drop policy if exists games_public_select
on public.games;

create policy games_public_select
on public.games
for select
to anon, authenticated
using (
    enabled = true
    or public.is_admin()
);


drop policy if exists games_admin_insert
on public.games;

create policy games_admin_insert
on public.games
for insert
to authenticated
with check (
    public.is_admin()
);


drop policy if exists games_admin_update
on public.games;

create policy games_admin_update
on public.games
for update
to authenticated
using (
    public.is_admin()
)
with check (
    public.is_admin()
);


drop policy if exists games_admin_delete
on public.games;

create policy games_admin_delete
on public.games
for delete
to authenticated
using (
    public.is_admin()
);


-- ============================================================
-- 28. GRANTS
-- ============================================================

grant usage on schema public
to anon, authenticated;

grant select on public.games
to anon, authenticated;

grant select on public.streamers
to anon, authenticated;

grant select on public.public_streamers
to anon, authenticated;

grant select on public.public_live_streamers
to anon, authenticated;

grant select on public.public_featured_games
to anon, authenticated;

grant insert on public.streamer_applications
to anon, authenticated;

grant select, update on public.streamer_applications
to authenticated;

grant select, update on public.profiles
to authenticated;


-- ============================================================
-- 29. FUNCTION GRANTS
-- ============================================================

grant execute on function public.is_admin()
to anon, authenticated;

grant execute on function public.is_admin_user(uuid)
to anon, authenticated;

grant execute on function public.admin_approve_application(uuid)
to authenticated;

grant execute on function public.admin_reject_application(uuid, text)
to authenticated;

grant execute on function public.set_streamer_live_status(uuid, boolean)
to authenticated;


-- ============================================================
-- 30. CLEAN NULL DEFAULTS
-- ============================================================

update public.streamer_applications
set status = 'pending'
where status is null;

update public.streamer_applications
set platform = 'Twitch'
where platform is null;

update public.streamers
set platform = 'Twitch'
where platform is null;

update public.streamers
set is_live = false
where is_live is null;

update public.streamers
set manual_live = false
where manual_live is null;

update public.streamers
set live_status = false
where live_status is null;

update public.streamers
set enabled = true
where enabled is null;

update public.games
set enabled = true
where enabled is null;

update public.games
set featured = false
where featured is null;


-- ============================================================
-- 31. STREAMER APPLICATION UNIQUE EMAIL INDEX
-- ============================================================
-- Prevents multiple pending applications from same email.
-- Does NOT delete old applications.
-- ============================================================

create unique index if not exists
idx_streamer_applications_pending_email
on public.streamer_applications(lower(email))
where status = 'pending';


-- ============================================================
-- 32. STREAMER EMAIL INDEX
-- ============================================================

create index if not exists
idx_streamers_email
on public.streamers(lower(email));


-- ============================================================
-- 33. FINAL DATABASE HEALTH CHECK
-- ============================================================

select
    'STREAMHUB V37 DATABASE READY' as status,

    exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
        and table_name = 'profiles'
    ) as profiles_ready,

    exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
        and table_name = 'streamer_applications'
    ) as applications_ready,

    exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
        and table_name = 'streamers'
    ) as streamers_ready,

    exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
        and table_name = 'games'
    ) as games_ready,

    exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
        and table_name = 'streamer_applications'
        and column_name = 'password_ciphertext'
    ) as password_ciphertext_ready,

    exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
        and table_name = 'streamers'
        and column_name = 'manual_live'
    ) as manual_live_ready,

    exists (
        select 1
        from pg_proc p
        join pg_namespace n
            on n.oid = p.pronamespace
        where n.nspname = 'public'
        and p.proname = 'is_admin'
    ) as is_admin_ready,

    exists (
        select 1
        from pg_proc p
        join pg_namespace n
            on n.oid = p.pronamespace
        where n.nspname = 'public'
        and p.proname = 'admin_approve_application'
    ) as admin_approve_ready,

    exists (
        select 1
        from pg_proc p
        join pg_namespace n
            on n.oid = p.pronamespace
        where n.nspname = 'public'
        and p.proname = 'set_streamer_live_status'
    ) as live_status_ready;


-- ============================================================
-- END STREAMHUB V37 FINAL DATABASE
-- ============================================================


-- ============================================================
-- STREAMHUB V38 COMPATIBILITY / WORKING WORKFLOW PATCH
-- Keeps V35 frontend design and adds the RPCs/columns it needs.
-- ============================================================

alter table public.profiles
  add column if not exists user_type text default 'user';

alter table public.streamers
  add column if not exists viewers integer not null default 0;

alter table public.streamers
  add column if not exists owner_id uuid references auth.users(id) on delete set null;

alter table public.streamers
  add column if not exists owner_email text;

alter table public.streamers
  add column if not exists sync_error text;

alter table public.streamers
  add column if not exists live_video_id text;

-- Keep profile metadata compatible with both old and V38 frontend.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id,email,username,display_name,role,user_type)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(coalesce(new.email,''),'@',1)),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email,''),'@',1)),
    'user',
    coalesce(new.raw_user_meta_data ->> 'user_type','user')
  )
  on conflict (id) do update set
    email = excluded.email,
    username = coalesce(public.profiles.username,excluded.username),
    display_name = coalesce(public.profiles.display_name,excluded.display_name),
    user_type = coalesce(public.profiles.user_type,excluded.user_type);
  return new;
end;
$$;

-- If an existing Auth user already has no profile, this creates it.
create or replace function public.ensure_my_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare p public.profiles;
begin
  if auth.uid() is null then
    return null;
  end if;

  insert into public.profiles (id,email,username,display_name,role,user_type)
  select
    u.id,
    u.email,
    coalesce(u.raw_user_meta_data ->> 'username', split_part(coalesce(u.email,''),'@',1)),
    coalesce(u.raw_user_meta_data ->> 'display_name', split_part(coalesce(u.email,''),'@',1)),
    'user',
    coalesce(u.raw_user_meta_data ->> 'user_type','user')
  from auth.users u
  where u.id = auth.uid()
  on conflict (id) do nothing;

  select * into p from public.profiles where id = auth.uid();
  return p;
end;
$$;

grant execute on function public.ensure_my_profile() to authenticated;

-- Approval: create/link the Auth user first, then attach streamer to that user.
create or replace function public.admin_approve_application(
  p_application_id uuid
)
returns public.streamer_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.streamer_applications;
  existing_streamer public.streamers;
  target_user uuid;
begin
  if not public.is_admin() then
    raise exception 'Sul puudub adminiõigus';
  end if;

  select * into a
  from public.streamer_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Taotlust ei leitud';
  end if;

  if a.status = 'approved' then
    return a;
  end if;

  select id into target_user
  from auth.users
  where lower(email) = lower(a.email)
  limit 1;

  if target_user is null then
    raise exception 'Auth kasutajakontot ei leitud. Proovi kinnitamist uuesti.';
  end if;

  update public.streamer_applications
  set
    status='approved',
    approved_at=now(),
    reviewed_at=now(),
    approved_by=auth.uid(),
    reviewed_by=auth.uid(),
    updated_at=now()
  where id=p_application_id
  returning * into a;

  select * into existing_streamer
  from public.streamers
  where application_id = a.id
  limit 1;

  if existing_streamer.id is not null then
    update public.streamers
    set
      user_id=target_user,
      owner_id=target_user,
      owner_email=a.email,
      email=a.email,
      name=a.name,
      display_name=a.name,
      username=split_part(a.email,'@',1),
      platform=a.platform,
      channel_url=a.channel_url,
      game=a.game,
      thumbnail_url=a.thumbnail_url,
      avatar_url=a.avatar_url,
      description=a.message,
      enabled=true,
      updated_at=now()
    where id=existing_streamer.id;
  else
    insert into public.streamers (
      user_id, application_id, owner_id, owner_email,
      email, name, username, display_name,
      platform, channel_url, game, thumbnail_url, avatar_url,
      description, is_live, manual_live, live_status,
      enabled, featured, viewers
    )
    values (
      target_user, a.id, target_user, a.email,
      a.email, a.name, split_part(a.email,'@',1), a.name,
      a.platform, a.channel_url, a.game, a.thumbnail_url, a.avatar_url,
      a.message, false, false, false,
      true, false, 0
    );
  end if;

  update public.profiles
  set
    user_type='streamer',
    display_name=coalesce(display_name,a.name),
    updated_at=now()
  where id=target_user;

  return a;
end;
$$;

grant execute on function public.admin_approve_application(uuid) to authenticated;

-- Link an already-approved legacy streamer to the currently logged-in user.
create or replace function public.claim_my_streamer()
returns public.streamers
language plpgsql
security definer
set search_path = public
as $$
declare
  u public.profiles;
  s public.streamers;
  user_email text;
begin
  if auth.uid() is null then
    raise exception 'Sisselogimine on vajalik';
  end if;

  select email into user_email from auth.users where id=auth.uid();

  select * into s
  from public.streamers
  where owner_id=auth.uid()
     or user_id=auth.uid()
  limit 1;

  if s.id is not null then
    return s;
  end if;

  select * into s
  from public.streamers
  where owner_id is null
    and lower(coalesce(email,'')) = lower(coalesce(user_email,''))
  order by created_at desc
  limit 1;

  if s.id is null then
    return null;
  end if;

  update public.streamers
  set
    user_id=auth.uid(),
    owner_id=auth.uid(),
    owner_email=user_email,
    updated_at=now()
  where id=s.id
  returning * into s;

  update public.profiles
  set user_type='streamer', updated_at=now()
  where id=auth.uid();

  return s;
end;
$$;

grant execute on function public.claim_my_streamer() to authenticated;

-- Streamer can only change their own LIVE state.
create or replace function public.set_my_stream_live(p_is_live boolean)
returns public.streamers
language plpgsql
security definer
set search_path = public
as $$
declare s public.streamers;
begin
  if auth.uid() is null then
    raise exception 'Sisselogimine on vajalik';
  end if;

  update public.streamers
  set
    is_live=p_is_live,
    manual_live=p_is_live,
    live_status=p_is_live,
    last_live_at=case when p_is_live then now() else last_live_at end,
    updated_at=now()
  where (owner_id=auth.uid() or user_id=auth.uid())
    and enabled=true
  returning * into s;

  if s.id is null then
    raise exception 'Sinu striimeriprofiili ei leitud';
  end if;

  return s;
end;
$$;

grant execute on function public.set_my_stream_live(boolean) to authenticated;

-- Sync function used by sync-streamers Edge Function.
create or replace function public.sync_streamer_status(
  p_id uuid,
  p_is_live boolean,
  p_viewers integer default 0,
  p_game text default null,
  p_thumbnail_url text default null,
  p_live_video_id text default null,
  p_error text default null
)
returns public.streamers
language plpgsql
security definer
set search_path = public
as $$
declare s public.streamers;
begin
  update public.streamers
  set
    is_live=coalesce(p_is_live,false),
    live_status=coalesce(p_is_live,false),
    viewers=greatest(coalesce(p_viewers,0),0),
    game=coalesce(p_game,game),
    thumbnail_url=coalesce(p_thumbnail_url,thumbnail_url),
    live_video_id=p_live_video_id,
    sync_error=p_error,
    last_live_at=case when p_is_live then now() else last_live_at end,
    updated_at=now()
  where id=p_id
  returning * into s;

  return s;
end;
$$;

grant execute on function public.sync_streamer_status(uuid,boolean,integer,text,text,text,text)
to anon, authenticated;

-- Rebuild the public views so V38 fields are available without exposing private data.
create or replace view public.public_streamers as
select
  id,name,username,display_name,platform,channel_url,game,
  thumbnail_url,avatar_url,description,is_live,manual_live,live_status,
  viewers,featured,created_at
from public.streamers
where enabled=true;

create or replace view public.public_live_streamers as
select
  id,name,username,display_name,platform,channel_url,game,
  thumbnail_url,avatar_url,description,is_live,manual_live,live_status,
  viewers
from public.streamers
where enabled=true and is_live=true;

grant select on public.public_streamers to anon, authenticated;
grant select on public.public_live_streamers to anon, authenticated;

-- V38 health check
select
  'STREAMHUB V38 READY' as status,
  exists(select 1 from information_schema.tables where table_schema='public' and table_name='profiles') as profiles_table_ready,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='streamers' and column_name='owner_id') as owner_id_ready,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='streamers' and column_name='viewers') as viewers_ready,
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='set_my_stream_live') as set_live_ready,
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='claim_my_streamer') as claim_ready,
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='sync_streamer_status') as sync_ready;

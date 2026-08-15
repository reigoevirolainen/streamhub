-- StreamHub v3 migration: TikTok + applications
-- Run as postgres in Supabase SQL Editor.

-- Existing streamers table: allow TikTok as a platform.
alter table public.streamers drop constraint if exists streamers_platform_check;
alter table public.streamers add constraint streamers_platform_check check (platform in ('Twitch','YouTube','Kick','TikTok'));

create table if not exists public.streamer_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  platform text not null check (platform in ('Twitch','YouTube','Kick','TikTok')),
  channel_url text not null,
  email text not null,
  message text,
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','approved','rejected'))
);

-- If the table already existed from the previous version, update its platform constraint.
alter table public.streamer_applications drop constraint if exists streamer_applications_platform_check;
alter table public.streamer_applications add constraint streamer_applications_platform_check check (platform in ('Twitch','YouTube','Kick','TikTok'));

alter table public.streamer_applications enable row level security;
grant insert on table public.streamer_applications to anon;
grant select, insert, update, delete on table public.streamer_applications to authenticated;

drop policy if exists "Anyone can submit streamer applications" on public.streamer_applications;
create policy "Anyone can submit streamer applications" on public.streamer_applications
for insert to anon, authenticated with check (
  length(name) between 2 and 80 and length(email) between 5 and 254 and length(channel_url) between 8 and 500
);

drop policy if exists "Admin can view applications" on public.streamer_applications;
create policy "Admin can view applications" on public.streamer_applications
for select to authenticated using (auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);

drop policy if exists "Admin can update applications" on public.streamer_applications;
create policy "Admin can update applications" on public.streamer_applications
for update to authenticated using (auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid)
with check (auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);

drop policy if exists "Admin can delete applications" on public.streamer_applications;
create policy "Admin can delete applications" on public.streamer_applications
for delete to authenticated using (auth.uid()='56a4036e-b37d-4928-abf2-8f49d709f5b7'::uuid);

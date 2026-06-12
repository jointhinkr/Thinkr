-- ============================================================
-- Thinkr — COMPLETE database setup.
-- Paste this whole file into the Supabase SQL Editor and Run.
-- (For a FRESH project only. Your existing project is already set up.)
-- ============================================================

-- ========== schema.sql ==========
-- ============================================================
-- Thinkr MVP — Supabase / Postgres schema
-- Run in the Supabase SQL editor, or via `supabase db push`.
-- Connection-first social: ideas, resonance (no likes/followers),
-- thought-twin matching, the Daily Spark, and Circles.
-- ============================================================

-- ----------------------------------------------------------------
-- PROFILES  (1:1 with auth.users)
-- The "fingerprint" jsonb stores onboarding answers used to match
-- people by how they think (Thought Twin matching).
-- ----------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique not null,
  display_name  text,
  bio           text,
  city          text,
  fingerprint   jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'thinker_' || left(new.id::text, 8)),
    new.raw_user_meta_data->>'display_name'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------
-- CIRCLES  (topic communities)
-- ----------------------------------------------------------------
create table public.circles (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  name         text not null,
  description  text,
  creator_id   uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now()
);

create table public.circle_members (
  circle_id  uuid not null references public.circles(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'member' check (role in ('member','organizer')),
  joined_at  timestamptz not null default now(),
  primary key (circle_id, user_id)
);

-- ----------------------------------------------------------------
-- THOUGHTS  (the idea-first feed)
-- parent_id supports idea inheritance / branches (replies that
-- credit the original thought). circle_id optionally scopes a
-- thought to a circle.
-- ----------------------------------------------------------------
create table public.thoughts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 2000),
  parent_id   uuid references public.thoughts(id) on delete set null,
  circle_id   uuid references public.circles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- RESONANCES  (private signal that replaces likes)
-- Only the owner can see their own resonance — no public counts.
-- ----------------------------------------------------------------
create table public.resonances (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  thought_id  uuid not null references public.thoughts(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, thought_id)
);

-- ----------------------------------------------------------------
-- MATCHES  (Thought Twin matches between two people)
-- score 0..1 computed from fingerprint similarity (see lib/matching.ts)
-- ----------------------------------------------------------------
create table public.matches (
  id          uuid primary key default gen_random_uuid(),
  user_a      uuid not null references public.profiles(id) on delete cascade,
  user_b      uuid not null references public.profiles(id) on delete cascade,
  score       numeric(5,4) not null default 0,
  created_at  timestamptz not null default now(),
  unique (user_a, user_b)
);

-- ----------------------------------------------------------------
-- THE DAILY SPARK  (one prompt per day; everyone answers)
-- ----------------------------------------------------------------
create table public.spark_prompts (
  id           uuid primary key default gen_random_uuid(),
  prompt       text not null,
  active_date  date unique not null
);

create table public.spark_responses (
  id          uuid primary key default gen_random_uuid(),
  prompt_id   uuid not null references public.spark_prompts(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 1000),
  created_at  timestamptz not null default now(),
  unique (prompt_id, author_id)
);

-- ----------------------------------------------------------------
-- INDEXES
-- ----------------------------------------------------------------
create index thoughts_created_idx        on public.thoughts (created_at desc);
create index thoughts_author_idx         on public.thoughts (author_id);
create index thoughts_circle_idx         on public.thoughts (circle_id);
create index thoughts_parent_idx         on public.thoughts (parent_id);
create index spark_responses_prompt_idx  on public.spark_responses (prompt_id, created_at desc);
create index circle_members_user_idx     on public.circle_members (user_id);

-- ----------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ----------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.circles         enable row level security;
alter table public.circle_members  enable row level security;
alter table public.thoughts        enable row level security;
alter table public.resonances      enable row level security;
alter table public.matches         enable row level security;
alter table public.spark_prompts   enable row level security;
alter table public.spark_responses enable row level security;

-- profiles
create policy "profiles viewable by everyone" on public.profiles for select using (true);
create policy "users update own profile"       on public.profiles for update using (auth.uid() = id);

-- circles
create policy "circles readable by all"  on public.circles for select using (true);
create policy "create circle as self"    on public.circles for insert with check (auth.uid() = creator_id);

-- circle members
create policy "members readable by all"  on public.circle_members for select using (true);
create policy "join circle as self"      on public.circle_members for insert with check (auth.uid() = user_id);
create policy "leave circle as self"     on public.circle_members for delete using (auth.uid() = user_id);

-- thoughts
create policy "thoughts readable by all" on public.thoughts for select using (true);
create policy "insert own thoughts"      on public.thoughts for insert with check (auth.uid() = author_id);
create policy "update own thoughts"      on public.thoughts for update using (auth.uid() = author_id);
create policy "delete own thoughts"      on public.thoughts for delete using (auth.uid() = author_id);

-- resonances  (private to the user)
create policy "view own resonances"   on public.resonances for select using (auth.uid() = user_id);
create policy "add own resonance"     on public.resonances for insert with check (auth.uid() = user_id);
create policy "remove own resonance"  on public.resonances for delete using (auth.uid() = user_id);

-- matches  (only the two people involved)
create policy "view own matches" on public.matches for select using (auth.uid() = user_a or auth.uid() = user_b);

-- daily spark
create policy "spark prompts readable by all"   on public.spark_prompts for select using (true);
create policy "spark responses readable by all" on public.spark_responses for select using (true);
create policy "insert own spark response"       on public.spark_responses for insert with check (auth.uid() = author_id);

-- ----------------------------------------------------------------
-- SEED: a few Daily Spark prompts to start
-- ----------------------------------------------------------------
insert into public.spark_prompts (prompt, active_date) values
  ('What''s something you changed your mind about this year?', current_date),
  ('What idea do you wish more people took seriously?',        current_date + 1),
  ('What''s a small thing you notice that others seem to miss?', current_date + 2)
on conflict (active_date) do nothing;

-- ========== migrations/0001_messaging_and_connections.sql ==========
-- Connections (request → approve → bond) + Messaging
create table if not exists public.connection_requests (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  constraint no_self_request check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);
create index if not exists connreq_addressee_idx on public.connection_requests(addressee_id, status);
create index if not exists connreq_requester_idx on public.connection_requests(requester_id, status);

create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  is_group   boolean not null default false,
  title      text,
  circle_id  uuid references public.circles(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  joined_at       timestamptz not null default now(),
  last_read_at    timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index if not exists convmem_user_idx on public.conversation_members(user_id);
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  body            text not null check (char_length(body) between 1 and 4000),
  created_at      timestamptz not null default now()
);
create index if not exists messages_conv_idx on public.messages(conversation_id, created_at desc);

alter table public.connection_requests enable row level security;
alter table public.conversations        enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages             enable row level security;

create policy "see own requests" on public.connection_requests for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);
create policy "send request as self" on public.connection_requests for insert
  with check (auth.uid() = requester_id);
create policy "respond to request" on public.connection_requests for update
  using (auth.uid() = addressee_id);

-- NOTE: the RLS helper functions and policies below are superseded by
-- 0003_security_hardening.sql (which moves the helpers into a private schema).

create or replace function public.respond_to_connection(req uuid, accept boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r record; conv uuid;
begin
  select * into r from public.connection_requests where id = req;
  if r is null then raise exception 'no such request'; end if;
  if r.addressee_id <> me then raise exception 'not your request'; end if;
  if accept then
    update public.connection_requests set status='accepted', responded_at=now() where id=req;
    select c.id into conv from public.conversations c
      join public.conversation_members m1 on m1.conversation_id=c.id and m1.user_id=r.requester_id
      join public.conversation_members m2 on m2.conversation_id=c.id and m2.user_id=r.addressee_id
      where c.is_group=false limit 1;
    if conv is null then
      insert into public.conversations(is_group, created_by) values(false, r.requester_id) returning id into conv;
      insert into public.conversation_members(conversation_id, user_id) values (conv, r.requester_id), (conv, r.addressee_id);
    end if;
    return conv;
  else
    update public.connection_requests set status='declined', responded_at=now() where id=req;
    return null;
  end if;
end; $$;

alter publication supabase_realtime add table public.messages;

-- ========== migrations/0002_onboarding_survey_fields.sql ==========
-- Onboarding survey fields: demographics + derived type on profiles,
-- and a PRIVATE (owner-only) table for sensitive matching preferences.
alter table public.profiles
  add column if not exists age int,
  add column if not exists gender text,
  add column if not exists state text,
  add column if not exists region text,
  add column if not exists thinking_type text;

create table if not exists public.match_prefs (
  user_id          uuid primary key references public.profiles(id) on delete cascade,
  match_genders    text[] not null default '{}',
  match_age        text,
  local_twin       boolean,
  politics_include boolean,
  political_lean   text,
  updated_at       timestamptz not null default now()
);
alter table public.match_prefs enable row level security;
create policy "own prefs select" on public.match_prefs for select using (auth.uid() = user_id);
create policy "own prefs insert" on public.match_prefs for insert with check (auth.uid() = user_id);
create policy "own prefs update" on public.match_prefs for update using (auth.uid() = user_id);

-- ========== migrations/0003_security_hardening.sql ==========
-- Security hardening: lock profiles to signed-in users, move RLS helpers into a
-- non-public schema (not REST-callable), tighten function grants.

drop policy if exists "profiles viewable by everyone" on public.profiles;
drop policy if exists "profiles viewable by authenticated" on public.profiles;
create policy "profiles viewable by authenticated" on public.profiles
  for select using (auth.uid() is not null);

create schema if not exists private;
revoke all on schema private from anon, public;
grant usage on schema private to authenticated;

create or replace function private.is_conversation_member(conv uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.conversation_members where conversation_id = conv and user_id = uid);
$$;
create or replace function private.are_connected(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.connection_requests
    where status='accepted' and ((requester_id=a and addressee_id=b) or (requester_id=b and addressee_id=a)));
$$;
grant execute on function private.is_conversation_member(uuid,uuid) to authenticated;
grant execute on function private.are_connected(uuid,uuid) to authenticated;

drop policy if exists "members see conversation" on public.conversations;
create policy "members see conversation" on public.conversations for select using (private.is_conversation_member(id, auth.uid()));
drop policy if exists "see members of my conversations" on public.conversation_members;
create policy "see members of my conversations" on public.conversation_members for select using (private.is_conversation_member(conversation_id, auth.uid()));
drop policy if exists "members read messages" on public.messages;
create policy "members read messages" on public.messages for select using (private.is_conversation_member(conversation_id, auth.uid()));
drop policy if exists "members send messages" on public.messages;
create policy "members send messages" on public.messages for insert with check (auth.uid()=sender_id and private.is_conversation_member(conversation_id, auth.uid()));

create or replace function public.start_direct_conversation(other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); conv uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if not private.are_connected(me, other) then raise exception 'not connected'; end if;
  select c.id into conv from public.conversations c
    join public.conversation_members m1 on m1.conversation_id=c.id and m1.user_id=me
    join public.conversation_members m2 on m2.conversation_id=c.id and m2.user_id=other
    where c.is_group=false limit 1;
  if conv is not null then return conv; end if;
  insert into public.conversations(is_group, created_by) values(false, me) returning id into conv;
  insert into public.conversation_members(conversation_id, user_id) values (conv, me), (conv, other);
  return conv;
end; $$;

drop function if exists public.is_conversation_member(uuid, uuid);
drop function if exists public.are_connected(uuid, uuid);

revoke execute on function public.respond_to_connection(uuid, boolean) from anon, public;
revoke execute on function public.start_direct_conversation(uuid) from anon, public;
grant  execute on function public.respond_to_connection(uuid, boolean) to authenticated;
grant  execute on function public.start_direct_conversation(uuid) to authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- ========== migrations/0004_age_gate_and_terms.sql ==========
-- 18+ age verification + Terms acceptance (set by the post-login age gate).
alter table public.profiles
  add column if not exists age_verified boolean not null default false,
  add column if not exists terms_accepted_at timestamptz;

-- ========== migrations/0005_ignite_gather_groups.sql ==========
-- IGNITE: live discussion rooms
create table if not exists public.live_rooms (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 140),
  topic text,
  kind text not null default 'open' check (kind in ('debate','study','chill','open')),
  host_id uuid not null references public.profiles(id) on delete cascade,
  is_live boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.room_participants (
  room_id uuid not null references public.live_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create table if not exists public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.live_rooms(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists room_messages_idx on public.room_messages(room_id, created_at);
create index if not exists room_participants_user_idx on public.room_participants(user_id);

alter table public.live_rooms        enable row level security;
alter table public.room_participants enable row level security;
alter table public.room_messages     enable row level security;

create policy "live rooms readable" on public.live_rooms for select using (auth.uid() is not null);
create policy "host creates room"   on public.live_rooms for insert with check (auth.uid() = host_id);
create policy "host updates room"    on public.live_rooms for update using (auth.uid() = host_id);
create policy "host deletes room"    on public.live_rooms for delete using (auth.uid() = host_id);
create policy "participants readable" on public.room_participants for select using (auth.uid() is not null);
create policy "join room as self"     on public.room_participants for insert with check (auth.uid() = user_id);
create policy "leave room as self"    on public.room_participants for delete using (auth.uid() = user_id);
create policy "room messages readable" on public.room_messages for select using (auth.uid() is not null);
create policy "post if participant"    on public.room_messages for insert
  with check (auth.uid() = sender_id and exists(select 1 from public.room_participants p where p.room_id = room_messages.room_id and p.user_id = auth.uid()));

-- GATHER: real-world meetups
create table if not exists public.gatherings (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 140),
  topic text,
  host_id uuid not null references public.profiles(id) on delete cascade,
  city text,
  location text,
  starts_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table if not exists public.gathering_rsvps (
  gathering_id uuid not null references public.gatherings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (gathering_id, user_id)
);
create index if not exists gatherings_when_idx on public.gatherings(starts_at);

alter table public.gatherings      enable row level security;
alter table public.gathering_rsvps enable row level security;

create policy "gatherings readable" on public.gatherings for select using (auth.uid() is not null);
create policy "host creates gathering" on public.gatherings for insert with check (auth.uid() = host_id);
create policy "host updates gathering"  on public.gatherings for update using (auth.uid() = host_id);
create policy "host deletes gathering"  on public.gatherings for delete using (auth.uid() = host_id);
create policy "rsvps readable" on public.gathering_rsvps for select using (auth.uid() is not null);
create policy "rsvp as self"   on public.gathering_rsvps for insert with check (auth.uid() = user_id);
create policy "unrsvp as self"  on public.gathering_rsvps for delete using (auth.uid() = user_id);

-- GROUP CHATS: open (or create) a circle's group conversation
create or replace function public.open_circle_conversation(circle uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); conv uuid; cname text;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.circle_members where circle_id = circle and user_id = me) then
    raise exception 'not a circle member';
  end if;
  select id into conv from public.conversations where circle_id = circle and is_group = true limit 1;
  if conv is null then
    select name into cname from public.circles where id = circle;
    insert into public.conversations(is_group, circle_id, title, created_by)
      values(true, circle, cname, me) returning id into conv;
  end if;
  if not exists(select 1 from public.conversation_members where conversation_id = conv and user_id = me) then
    insert into public.conversation_members(conversation_id, user_id) values(conv, me);
  end if;
  return conv;
end; $$;
revoke execute on function public.open_circle_conversation(uuid) from anon, public;
grant execute on function public.open_circle_conversation(uuid) to authenticated;

alter publication supabase_realtime add table public.room_messages;
alter publication supabase_realtime add table public.room_participants;

-- ========== migrations/0006_avatars_and_media.sql ==========
-- Profile pictures + image/video on posts, backed by Supabase Storage.
alter table public.profiles add column if not exists avatar_url text;
alter table public.thoughts add column if not exists media_url text;
alter table public.thoughts add column if not exists media_type text check (media_type in ('image','video'));

-- public-read buckets with size + mime limits
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars','avatars', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media','media', true, 104857600, array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm'])
on conflict (id) do update set public = true, file_size_limit = 104857600,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm'];

-- storage RLS: public read; users write only inside their own <uid>/ folder
drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists "avatars user write" on storage.objects;
create policy "avatars user write" on storage.objects for insert with check (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars user update" on storage.objects;
create policy "avatars user update" on storage.objects for update using (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars user delete" on storage.objects;
create policy "avatars user delete" on storage.objects for delete using (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "media public read" on storage.objects;
create policy "media public read" on storage.objects for select using (bucket_id = 'media');
drop policy if exists "media user write" on storage.objects;
create policy "media user write" on storage.objects for insert with check (bucket_id='media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "media user delete" on storage.objects;
create policy "media user delete" on storage.objects for delete using (bucket_id='media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ========== migrations/0007_beta_testers.sql ==========
-- Authorized Beta Tester Exception: approved under-18 testers who entered a
-- valid universal beta access code at the age gate. Recorded for audit and to
-- drive under-18-only matching. See the Authorized Beta Tester Exception in the
-- Terms of Service.
alter table public.profiles
  add column if not exists beta_tester boolean not null default false,
  add column if not exists beta_code_redeemed_at timestamptz;

-- ========== migrations/0008_social_graph_and_safety.sql ==========
-- Round 2: social graph (Muse follows + Connections), blocking, reporting,
-- AI moderation/suspension, and connection-request privacy.

alter table public.profiles
  add column if not exists allow_connection_requests boolean not null default true,
  add column if not exists suspended boolean not null default false,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_reason text;

create table if not exists public.muses (
  muser_id   uuid not null references public.profiles(id) on delete cascade,
  muse_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint no_self_muse check (muser_id <> muse_id),
  primary key (muser_id, muse_id)
);
create index if not exists muses_muse_idx  on public.muses(muse_id);
create index if not exists muses_muser_idx on public.muses(muser_id);
alter table public.muses enable row level security;
create policy "muses readable by authenticated" on public.muses for select using (auth.uid() is not null);
create policy "muse as self"   on public.muses for insert with check (auth.uid() = muser_id);
create policy "unmuse as self"  on public.muses for delete using (auth.uid() = muser_id);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint no_self_block check (blocker_id <> blocked_id),
  primary key (blocker_id, blocked_id)
);
create index if not exists blocks_blocked_idx on public.blocks(blocked_id);
alter table public.blocks enable row level security;
create policy "see own blocks" on public.blocks for select using (auth.uid() = blocker_id);
create policy "block as self"  on public.blocks for insert with check (auth.uid() = blocker_id);
create policy "unblock as self" on public.blocks for delete using (auth.uid() = blocker_id);

create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  reporter_id   uuid not null references public.profiles(id) on delete cascade,
  reported_id   uuid not null references public.profiles(id) on delete cascade,
  thought_id    uuid references public.thoughts(id) on delete set null,
  reason        text not null check (char_length(reason) between 1 and 1000),
  status        text not null default 'pending'
                  check (status in ('pending','reviewed','actioned','dismissed')),
  ai_severity   text,
  ai_action     text,
  ai_rationale  text,
  ai_checked_at timestamptz,
  created_at    timestamptz not null default now(),
  constraint no_self_report check (reporter_id <> reported_id)
);
create index if not exists reports_reported_idx on public.reports(reported_id);
create index if not exists reports_status_idx   on public.reports(status);
alter table public.reports enable row level security;
create policy "file own report" on public.reports for insert with check (auth.uid() = reporter_id);
create policy "see own reports" on public.reports for select using (auth.uid() = reporter_id);

create or replace function private.can_request_connection(requester uuid, addressee uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    not exists (
      select 1 from public.blocks b
      where (b.blocker_id = addressee and b.blocked_id = requester)
         or (b.blocker_id = requester and b.blocked_id = addressee)
    )
    and exists (
      select 1 from public.profiles p
      where p.id = addressee and p.allow_connection_requests = true
    );
$$;
grant execute on function private.can_request_connection(uuid, uuid) to authenticated;

drop policy if exists "send request as self" on public.connection_requests;
create policy "send request as self" on public.connection_requests for insert
  with check (auth.uid() = requester_id and private.can_request_connection(requester_id, addressee_id));

create or replace function public.block_user(target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not authenticated'; end if;
  if me = target then raise exception 'cannot block yourself'; end if;
  insert into public.blocks(blocker_id, blocked_id) values (me, target) on conflict do nothing;
  delete from public.muses
    where (muser_id = me and muse_id = target) or (muser_id = target and muse_id = me);
  delete from public.connection_requests
    where (requester_id = me and addressee_id = target) or (requester_id = target and addressee_id = me);
end; $$;
revoke execute on function public.block_user(uuid) from anon, public;
grant execute on function public.block_user(uuid) to authenticated;

-- ========== migrations/0009_livestream_and_resonance_privacy.sql ==========
-- Round 3: livestreams, resonance privacy, and the state opt-out.
alter table public.profiles
  add column if not exists resonances_private boolean not null default true,
  add column if not exists livestream_revoked boolean not null default false;

alter table public.live_rooms
  add column if not exists is_stream boolean not null default false;

drop policy if exists "view public resonances" on public.resonances;
create policy "view public resonances" on public.resonances for select
  using (exists (
    select 1 from public.profiles p
    where p.id = resonances.user_id and p.resonances_private = false
  ));

create or replace function public.revoke_livestream(host uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not authenticated'; end if;
  update public.profiles set livestream_revoked = true where id = host;
  update public.live_rooms set is_live = false where host_id = host and is_stream = true;
end; $$;
revoke execute on function public.revoke_livestream(uuid) from anon, public;
grant execute on function public.revoke_livestream(uuid) to authenticated;

-- ========== migrations/0010_quiz_hashtags_streak.sql ==========
-- Round 4: endless Twin quiz, metric hashtags, and the Daily Spark streak.
create table if not exists public.twin_quiz_answers (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  qkey       text not null,
  choice     text not null check (choice in ('a','b')),
  created_at timestamptz not null default now(),
  primary key (user_id, qkey)
);
create index if not exists twin_quiz_user_idx on public.twin_quiz_answers(user_id);
alter table public.twin_quiz_answers enable row level security;
drop policy if exists "own quiz select" on public.twin_quiz_answers;
create policy "own quiz select" on public.twin_quiz_answers for select using (auth.uid() = user_id);
drop policy if exists "own quiz insert" on public.twin_quiz_answers;
create policy "own quiz insert" on public.twin_quiz_answers for insert with check (auth.uid() = user_id);
drop policy if exists "own quiz update" on public.twin_quiz_answers;
create policy "own quiz update" on public.twin_quiz_answers for update using (auth.uid() = user_id);

create table if not exists public.thought_hashtags (
  thought_id uuid not null references public.thoughts(id) on delete cascade,
  tag        text not null,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (thought_id, tag)
);
create index if not exists hashtags_tag_idx    on public.thought_hashtags(tag, created_at desc);
create index if not exists hashtags_author_idx on public.thought_hashtags(author_id);
alter table public.thought_hashtags enable row level security;
drop policy if exists "hashtags readable" on public.thought_hashtags;
create policy "hashtags readable" on public.thought_hashtags for select using (auth.uid() is not null);
drop policy if exists "tag own thoughts" on public.thought_hashtags;
create policy "tag own thoughts" on public.thought_hashtags for insert with check (auth.uid() = author_id);
drop policy if exists "untag own thoughts" on public.thought_hashtags;
create policy "untag own thoughts" on public.thought_hashtags for delete using (auth.uid() = author_id);

alter table public.profiles
  add column if not exists spark_streak int not null default 0,
  add column if not exists spark_last_answered date;

create or replace function public.record_spark_answer()
returns int language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); last date; streak int; today date := current_date;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select spark_last_answered, spark_streak into last, streak from public.profiles where id = me;
  if last = today then
    return coalesce(streak, 1);
  elsif last = today - 1 then
    streak := coalesce(streak, 0) + 1;
  else
    streak := 1;
  end if;
  update public.profiles set spark_streak = streak, spark_last_answered = today where id = me;
  return streak;
end; $$;
revoke execute on function public.record_spark_answer() from anon, public;
grant execute on function public.record_spark_answer() to authenticated;

-- ========== migrations/0011_roles_and_admin.sql ==========
-- Session 1: user role system (user / premium / admin) + admin daily-question editor.
alter table public.profiles
  add column if not exists role text not null default 'user'
    check (role in ('user', 'premium', 'admin'));

create or replace function private.is_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = uid and role = 'admin');
$$;
create or replace function private.has_premium(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = uid and role in ('premium', 'admin'));
$$;
grant execute on function private.is_admin(uuid)   to authenticated;
grant execute on function private.has_premium(uuid) to authenticated;

create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() is not null and not private.is_admin(auth.uid()) then
      raise exception 'not allowed to change role';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists guard_profile_privileges on public.profiles;
create trigger guard_profile_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

create or replace function public.set_daily_question(q text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not authenticated'; end if;
  if not private.is_admin(me) then raise exception 'admins only'; end if;
  if q is null or char_length(btrim(q)) = 0 then raise exception 'question is empty'; end if;
  insert into public.spark_prompts(prompt, active_date)
    values (btrim(q), current_date)
    on conflict (active_date) do update set prompt = excluded.prompt;
end; $$;
revoke execute on function public.set_daily_question(text) from anon, public;
grant execute on function public.set_daily_question(text) to authenticated;

-- ========== migrations/0012_video_access_stripe.sql ==========
-- Session 2: Thinkr+ $25 one-time video unlock (Stripe).
alter table public.profiles
  add column if not exists has_video_access boolean not null default false;

create table if not exists public.stripe_events (
  id           text primary key,
  type         text,
  processed_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;

create or replace function private.has_video_or_premium(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = uid and (has_video_access = true or role in ('premium', 'admin'))
  );
$$;
grant execute on function private.has_video_or_premium(uuid) to authenticated;

drop policy if exists "host creates room" on public.live_rooms;
create policy "host creates room" on public.live_rooms for insert
  with check (
    auth.uid() = host_id
    and (is_stream = false or private.has_video_or_premium(auth.uid()))
  );

create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not private.is_admin(auth.uid()) then
    if new.role is distinct from old.role then
      raise exception 'not allowed to change role';
    end if;
    if new.has_video_access is distinct from old.has_video_access then
      raise exception 'not allowed to change video access';
    end if;
  end if;
  return new;
end; $$;

create or replace function public.grant_from_stripe(
  event_id text, event_type text, target uuid, kind text, tries int default 0
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.stripe_events(id, type) values (event_id, event_type);
  if kind = 'video' then
    update public.profiles set has_video_access = true where id = target;
  end if;
exception when unique_violation then
  return;
end; $$;
revoke execute on function public.grant_from_stripe(text, text, uuid, text, int) from anon, authenticated, public;
grant  execute on function public.grant_from_stripe(text, text, uuid, text, int) to service_role;

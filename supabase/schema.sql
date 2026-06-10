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

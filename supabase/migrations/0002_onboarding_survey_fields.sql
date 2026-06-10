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

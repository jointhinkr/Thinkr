-- Round 4: endless Twin quiz, metric hashtags, and the Daily Spark streak.

-- ---------------------------------------------------------------
-- Twin quiz answers (this/that questions that fine-tune matching).
-- Each answer also writes a q:<key> dimension into profiles.fingerprint.
-- ---------------------------------------------------------------
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

-- ---------------------------------------------------------------
-- Hashtags extracted from thoughts (feeds search, tag pages, metrics).
-- ---------------------------------------------------------------
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

-- ---------------------------------------------------------------
-- Daily Spark streak
-- ---------------------------------------------------------------
alter table public.profiles
  add column if not exists spark_streak int not null default 0,
  add column if not exists spark_last_answered date;

-- Record an answer to today's spark and return the running streak.
create or replace function public.record_spark_answer()
returns int language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); last date; streak int; today date := current_date;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select spark_last_answered, spark_streak into last, streak from public.profiles where id = me;
  if last = today then
    return coalesce(streak, 1);                 -- already counted today
  elsif last = today - 1 then
    streak := coalesce(streak, 0) + 1;          -- consecutive day
  else
    streak := 1;                                -- first answer or streak broken
  end if;
  update public.profiles set spark_streak = streak, spark_last_answered = today where id = me;
  return streak;
end; $$;
revoke execute on function public.record_spark_answer() from anon, public;
grant execute on function public.record_spark_answer() to authenticated;

-- 18+ age verification + Terms acceptance (set by the post-login age gate).
alter table public.profiles
  add column if not exists age_verified boolean not null default false,
  add column if not exists terms_accepted_at timestamptz;

-- Authorized Beta Tester Exception: approved under-18 testers who entered a
-- valid universal beta access code at the age gate. Recorded for audit and to
-- drive under-18-only matching. See the Authorized Beta Tester Exception in the
-- Terms of Service.
alter table public.profiles
  add column if not exists beta_tester boolean not null default false,
  add column if not exists beta_code_redeemed_at timestamptz;

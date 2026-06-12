-- Session 1: user role system (user / premium / admin) + admin daily-question editor.

-- ---------------------------------------------------------------
-- Role on profiles. Default 'user' for all existing + new rows.
-- ---------------------------------------------------------------
alter table public.profiles
  add column if not exists role text not null default 'user'
    check (role in ('user', 'premium', 'admin'));

-- ---------------------------------------------------------------
-- DB-level permission helpers (mirror lib/auth/permissions.ts).
-- admin inherits premium.
-- ---------------------------------------------------------------
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

-- ---------------------------------------------------------------
-- SECURITY: stop users from escalating their own role.
-- The "users update own profile" policy allows updating any column, so without
-- this a user could set role='admin' directly via the API. Only an existing
-- admin, or the service role (auth.uid() is null — seed script / webhooks),
-- may change role. Normal profile edits (role unchanged) pass straight through.
-- ---------------------------------------------------------------
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

-- ---------------------------------------------------------------
-- Admin-only: set the daily question (today's Daily Spark prompt).
-- Enforced in the DB — non-admins are rejected regardless of UI.
-- ---------------------------------------------------------------
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

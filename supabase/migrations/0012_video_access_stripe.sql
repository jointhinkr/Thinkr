-- Session 2: Thinkr+ $25 one-time video unlock (Stripe).

-- Entitlement flag — granted ONLY by the Stripe webhook (service role).
alter table public.profiles
  add column if not exists has_video_access boolean not null default false;

-- Idempotency ledger: each Stripe event id is processed at most once.
create table if not exists public.stripe_events (
  id           text primary key,
  type         text,
  processed_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
-- No policies → unreadable/unwritable by anon+authenticated; only the service
-- role (webhook) touches it.

-- Helper: does this user get video? (paid OR premium/admin).
create or replace function private.has_video_or_premium(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = uid and (has_video_access = true or role in ('premium', 'admin'))
  );
$$;
grant execute on function private.has_video_or_premium(uuid) to authenticated;

-- SERVER-SIDE gate: a livestream (is_stream = true) can only be created by a
-- host who has video access. Text rooms (is_stream = false) stay open to all.
drop policy if exists "host creates room" on public.live_rooms;
create policy "host creates room" on public.live_rooms for insert
  with check (
    auth.uid() = host_id
    and (is_stream = false or private.has_video_or_premium(auth.uid()))
  );

-- Extend the privilege guard: users may not self-grant role or video access.
-- Service role (auth.uid() null, used by the webhook) and admins are exempt.
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

-- Transactional, idempotent grant called by the Stripe webhook (service role).
-- The event-id insert + the entitlement change happen in one transaction; a
-- duplicate event hits the unique violation and no-ops. `tries` is unused here
-- (Session 3 extends this same function to handle try-pack top-ups).
create or replace function public.grant_from_stripe(
  event_id text, event_type text, target uuid, kind text, tries int default 0
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.stripe_events(id, type) values (event_id, event_type);
  if kind = 'video' then
    update public.profiles set has_video_access = true where id = target;
  end if;
exception when unique_violation then
  return; -- event already processed
end; $$;
revoke execute on function public.grant_from_stripe(text, text, uuid, text, int) from anon, authenticated, public;
grant  execute on function public.grant_from_stripe(text, text, uuid, text, int) to service_role;
-- Round 2: social graph (Muse follows + Connections), blocking, reporting,
-- AI moderation/suspension, and connection-request privacy.

-- ---------------------------------------------------------------
-- profiles: privacy + moderation state
-- ---------------------------------------------------------------
alter table public.profiles
  add column if not exists allow_connection_requests boolean not null default true,
  add column if not exists suspended boolean not null default false,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_reason text;

-- ---------------------------------------------------------------
-- MUSES — one-directional "follow". muser follows muse.
-- A mutual pair (both directions) is surfaced in-app as a Connection
-- only once a connection_request is also accepted (messaging gate).
-- ---------------------------------------------------------------
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

-- ---------------------------------------------------------------
-- BLOCKS
-- ---------------------------------------------------------------
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

-- ---------------------------------------------------------------
-- REPORTS  (moderation queue; assessed by AI, see /api/moderate)
-- ---------------------------------------------------------------
create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  reporter_id   uuid not null references public.profiles(id) on delete cascade,
  reported_id   uuid not null references public.profiles(id) on delete cascade,
  thought_id    uuid references public.thoughts(id) on delete set null,
  reason        text not null check (char_length(reason) between 1 and 1000),
  status        text not null default 'pending'
                  check (status in ('pending','reviewed','actioned','dismissed')),
  ai_severity   text,   -- none | low | medium | high | severe
  ai_action     text,   -- none | flag | suspend
  ai_rationale  text,
  ai_checked_at timestamptz,
  created_at    timestamptz not null default now(),
  constraint no_self_report check (reporter_id <> reported_id)
);
create index if not exists reports_reported_idx on public.reports(reported_id);
create index if not exists reports_status_idx   on public.reports(status);
alter table public.reports enable row level security;
-- Reporters can file and see their own reports. Moderation reads/writes via service role.
create policy "file own report" on public.reports for insert with check (auth.uid() = reporter_id);
create policy "see own reports" on public.reports for select using (auth.uid() = reporter_id);

-- ---------------------------------------------------------------
-- Connection-request gating: respect blocks + allow_connection_requests.
-- SECURITY DEFINER so the check can read the addressee's blocks/flag.
-- ---------------------------------------------------------------
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

-- ---------------------------------------------------------------
-- block_user(target): atomic block + cleanup of muses & connection state.
-- ---------------------------------------------------------------
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

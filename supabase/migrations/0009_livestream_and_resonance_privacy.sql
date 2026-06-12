-- Round 3: livestreams, resonance privacy, and the state opt-out.

-- profiles: resonance visibility + livestream privilege
alter table public.profiles
  add column if not exists resonances_private boolean not null default true,
  add column if not exists livestream_revoked boolean not null default false;

-- live_rooms double as livestreams when is_stream = true (camera + chat).
alter table public.live_rooms
  add column if not exists is_stream boolean not null default false;

-- Resonances become viewable by others ONLY when the owner has opted in
-- (resonances_private = false). Owner-view policy from schema.sql still applies.
drop policy if exists "view public resonances" on public.resonances;
create policy "view public resonances" on public.resonances for select
  using (exists (
    select 1 from public.profiles p
    where p.id = resonances.user_id and p.resonances_private = false
  ));

-- Revoke a host's livestream privileges and end any live stream they're running.
-- Called immediately when a stream is reported (strong moderation by design).
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

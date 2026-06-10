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

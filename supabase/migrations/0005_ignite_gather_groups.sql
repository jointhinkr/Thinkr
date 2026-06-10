-- IGNITE: live discussion rooms
create table if not exists public.live_rooms (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 140),
  topic text,
  kind text not null default 'open' check (kind in ('debate','study','chill','open')),
  host_id uuid not null references public.profiles(id) on delete cascade,
  is_live boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.room_participants (
  room_id uuid not null references public.live_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create table if not exists public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.live_rooms(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists room_messages_idx on public.room_messages(room_id, created_at);
create index if not exists room_participants_user_idx on public.room_participants(user_id);

alter table public.live_rooms        enable row level security;
alter table public.room_participants enable row level security;
alter table public.room_messages     enable row level security;

create policy "live rooms readable" on public.live_rooms for select using (auth.uid() is not null);
create policy "host creates room"   on public.live_rooms for insert with check (auth.uid() = host_id);
create policy "host updates room"    on public.live_rooms for update using (auth.uid() = host_id);
create policy "host deletes room"    on public.live_rooms for delete using (auth.uid() = host_id);
create policy "participants readable" on public.room_participants for select using (auth.uid() is not null);
create policy "join room as self"     on public.room_participants for insert with check (auth.uid() = user_id);
create policy "leave room as self"    on public.room_participants for delete using (auth.uid() = user_id);
create policy "room messages readable" on public.room_messages for select using (auth.uid() is not null);
create policy "post if participant"    on public.room_messages for insert
  with check (auth.uid() = sender_id and exists(select 1 from public.room_participants p where p.room_id = room_messages.room_id and p.user_id = auth.uid()));

-- GATHER: real-world meetups
create table if not exists public.gatherings (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 140),
  topic text,
  host_id uuid not null references public.profiles(id) on delete cascade,
  city text,
  location text,
  starts_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table if not exists public.gathering_rsvps (
  gathering_id uuid not null references public.gatherings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (gathering_id, user_id)
);
create index if not exists gatherings_when_idx on public.gatherings(starts_at);

alter table public.gatherings      enable row level security;
alter table public.gathering_rsvps enable row level security;

create policy "gatherings readable" on public.gatherings for select using (auth.uid() is not null);
create policy "host creates gathering" on public.gatherings for insert with check (auth.uid() = host_id);
create policy "host updates gathering"  on public.gatherings for update using (auth.uid() = host_id);
create policy "host deletes gathering"  on public.gatherings for delete using (auth.uid() = host_id);
create policy "rsvps readable" on public.gathering_rsvps for select using (auth.uid() is not null);
create policy "rsvp as self"   on public.gathering_rsvps for insert with check (auth.uid() = user_id);
create policy "unrsvp as self"  on public.gathering_rsvps for delete using (auth.uid() = user_id);

-- GROUP CHATS: open (or create) a circle's group conversation
create or replace function public.open_circle_conversation(circle uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); conv uuid; cname text;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.circle_members where circle_id = circle and user_id = me) then
    raise exception 'not a circle member';
  end if;
  select id into conv from public.conversations where circle_id = circle and is_group = true limit 1;
  if conv is null then
    select name into cname from public.circles where id = circle;
    insert into public.conversations(is_group, circle_id, title, created_by)
      values(true, circle, cname, me) returning id into conv;
  end if;
  if not exists(select 1 from public.conversation_members where conversation_id = conv and user_id = me) then
    insert into public.conversation_members(conversation_id, user_id) values(conv, me);
  end if;
  return conv;
end; $$;
revoke execute on function public.open_circle_conversation(uuid) from anon, public;
grant execute on function public.open_circle_conversation(uuid) to authenticated;

alter publication supabase_realtime add table public.room_messages;
alter publication supabase_realtime add table public.room_participants;

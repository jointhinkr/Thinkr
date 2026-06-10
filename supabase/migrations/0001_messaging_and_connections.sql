-- Connections (request → approve → bond) + Messaging
create table if not exists public.connection_requests (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  constraint no_self_request check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);
create index if not exists connreq_addressee_idx on public.connection_requests(addressee_id, status);
create index if not exists connreq_requester_idx on public.connection_requests(requester_id, status);

create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  is_group   boolean not null default false,
  title      text,
  circle_id  uuid references public.circles(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  joined_at       timestamptz not null default now(),
  last_read_at    timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index if not exists convmem_user_idx on public.conversation_members(user_id);
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  body            text not null check (char_length(body) between 1 and 4000),
  created_at      timestamptz not null default now()
);
create index if not exists messages_conv_idx on public.messages(conversation_id, created_at desc);

alter table public.connection_requests enable row level security;
alter table public.conversations        enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages             enable row level security;

create policy "see own requests" on public.connection_requests for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);
create policy "send request as self" on public.connection_requests for insert
  with check (auth.uid() = requester_id);
create policy "respond to request" on public.connection_requests for update
  using (auth.uid() = addressee_id);

-- NOTE: the RLS helper functions and policies below are superseded by
-- 0003_security_hardening.sql (which moves the helpers into a private schema).

create or replace function public.respond_to_connection(req uuid, accept boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r record; conv uuid;
begin
  select * into r from public.connection_requests where id = req;
  if r is null then raise exception 'no such request'; end if;
  if r.addressee_id <> me then raise exception 'not your request'; end if;
  if accept then
    update public.connection_requests set status='accepted', responded_at=now() where id=req;
    select c.id into conv from public.conversations c
      join public.conversation_members m1 on m1.conversation_id=c.id and m1.user_id=r.requester_id
      join public.conversation_members m2 on m2.conversation_id=c.id and m2.user_id=r.addressee_id
      where c.is_group=false limit 1;
    if conv is null then
      insert into public.conversations(is_group, created_by) values(false, r.requester_id) returning id into conv;
      insert into public.conversation_members(conversation_id, user_id) values (conv, r.requester_id), (conv, r.addressee_id);
    end if;
    return conv;
  else
    update public.connection_requests set status='declined', responded_at=now() where id=req;
    return null;
  end if;
end; $$;

alter publication supabase_realtime add table public.messages;

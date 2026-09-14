create table if not exists public.ashyk_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-F0-9]{6}$'),
  status text not null default 'waiting' check (status in ('waiting','playing','finished','abandoned')),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  guest_user_id uuid references auth.users(id) on delete set null,
  active_user_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null default 0,
  game_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ashyk_rooms enable row level security;
revoke all on public.ashyk_rooms from anon;
revoke all on public.ashyk_rooms from authenticated;
grant select on public.ashyk_rooms to authenticated;

drop policy if exists ashyk_rooms_members_read on public.ashyk_rooms;
create policy ashyk_rooms_members_read
on public.ashyk_rooms
for select
to authenticated
using ((select auth.uid()) = host_user_id or (select auth.uid()) = guest_user_id);

create or replace function public.ashyk_create_room(initial_state jsonb default '{}'::jsonb)
returns public.ashyk_rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  room public.ashyk_rooms;
  candidate text;
begin
  if uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  loop
    candidate := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    begin
      insert into public.ashyk_rooms(code, host_user_id, active_user_id, game_state)
      values (candidate, uid, uid, coalesce(initial_state, '{}'::jsonb))
      returning * into room;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;
  return room;
end;
$$;

create or replace function public.ashyk_join_room(room_code text)
returns public.ashyk_rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  room public.ashyk_rooms;
begin
  if uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select * into room
  from public.ashyk_rooms
  where code = upper(trim(room_code))
  for update;
  if room.id is null then raise exception 'room not found' using errcode = 'P0002'; end if;
  if room.host_user_id = uid then return room; end if;
  if room.status <> 'waiting' or room.guest_user_id is not null then raise exception 'room is not available' using errcode = 'P0001'; end if;
  update public.ashyk_rooms
  set guest_user_id = uid,
      status = 'playing',
      revision = revision + 1,
      updated_at = now()
  where id = room.id
  returning * into room;
  return room;
end;
$$;

create or replace function public.ashyk_submit_state(
  room_id uuid,
  expected_revision bigint,
  next_state jsonb,
  next_active_user_id uuid,
  next_status text default 'playing'
)
returns public.ashyk_rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  room public.ashyk_rooms;
begin
  if uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if next_status not in ('waiting','playing','finished','abandoned') then raise exception 'invalid room status'; end if;
  select * into room from public.ashyk_rooms where id = room_id for update;
  if room.id is null then raise exception 'room not found' using errcode = 'P0002'; end if;
  if uid <> room.host_user_id and uid is distinct from room.guest_user_id then raise exception 'not a room member' using errcode = '42501'; end if;
  if room.status in ('finished','abandoned') then raise exception 'room is closed'; end if;
  if uid <> room.active_user_id then raise exception 'not your turn' using errcode = '42501'; end if;
  if room.revision <> expected_revision then raise exception 'stale room revision' using errcode = '40001'; end if;
  if next_active_user_id <> room.host_user_id and next_active_user_id is distinct from room.guest_user_id then raise exception 'invalid next player'; end if;
  update public.ashyk_rooms
  set game_state = coalesce(next_state, '{}'::jsonb),
      active_user_id = next_active_user_id,
      status = next_status,
      revision = revision + 1,
      updated_at = now()
  where id = room.id
  returning * into room;
  return room;
end;
$$;

create or replace function public.ashyk_leave_room(room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  room public.ashyk_rooms;
begin
  if uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select * into room from public.ashyk_rooms where id = room_id for update;
  if room.id is null then return; end if;
  if uid <> room.host_user_id and uid is distinct from room.guest_user_id then raise exception 'not a room member' using errcode = '42501'; end if;
  update public.ashyk_rooms
  set status = 'abandoned',
      revision = revision + 1,
      updated_at = now()
  where id = room.id;
end;
$$;

revoke all on function public.ashyk_create_room(jsonb) from public, anon;
revoke all on function public.ashyk_join_room(text) from public, anon;
revoke all on function public.ashyk_submit_state(uuid,bigint,jsonb,uuid,text) from public, anon;
revoke all on function public.ashyk_leave_room(uuid) from public, anon;
grant execute on function public.ashyk_create_room(jsonb) to authenticated;
grant execute on function public.ashyk_join_room(text) to authenticated;
grant execute on function public.ashyk_submit_state(uuid,bigint,jsonb,uuid,text) to authenticated;
grant execute on function public.ashyk_leave_room(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ashyk_rooms'
  ) then
    alter publication supabase_realtime add table public.ashyk_rooms;
  end if;
end $$;

begin;

create table if not exists public.ashyk_invites(
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.ashyk_rooms(id) on delete cascade,
  host_user_id uuid not null references auth.users(id) on delete cascade,
  friend_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','accepted','declined','cancelled','expired')),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  expires_at timestamptz not null default(now()+interval '10 minutes'),accepted_at timestamptz,
  check(host_user_id<>friend_user_id)
);
create unique index if not exists ashyk_invites_pending_pair_unique on public.ashyk_invites(least(host_user_id,friend_user_id),greatest(host_user_id,friend_user_id)) where status='pending';
create index if not exists ashyk_invites_friend_pending_idx on public.ashyk_invites(friend_user_id,status,created_at desc);
alter table public.ashyk_invites enable row level security;
revoke all on public.ashyk_invites from public,anon,authenticated;
grant select on public.ashyk_invites to authenticated;
drop policy if exists ashyk_invites_members_read on public.ashyk_invites;
create policy ashyk_invites_members_read on public.ashyk_invites for select to authenticated using(auth.uid()=host_user_id or auth.uid()=friend_user_id);

create or replace function private.expire_ashyk_invites() returns void language plpgsql security definer set search_path='' as $$
begin
  update public.ashyk_rooms r set status='abandoned',revision=revision+1,updated_at=now()
  from public.ashyk_invites i where i.room_id=r.id and i.status='pending' and i.expires_at<=now() and r.status='waiting';
  update public.ashyk_invites set status='expired',updated_at=now() where status='pending' and expires_at<=now();
end $$;

drop function if exists public.ashyk_create_room(jsonb);
drop function if exists public.ashyk_join_room(text);
alter table public.ashyk_rooms drop column if exists code;

create or replace function public.ashyk_invite_create(p_friend_user_id uuid,p_initial_state jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_room public.ashyk_rooms;v_invite public.ashyk_invites;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  perform private.expire_ashyk_invites();
  if p_friend_user_id is null or p_friend_user_id=v_actor then raise exception 'invalid friend'; end if;
  if not private.social_are_friends(v_actor,p_friend_user_id) or private.social_blocked(v_actor,p_friend_user_id) then raise exception 'friend unavailable' using errcode='42501'; end if;
  if exists(select 1 from public.ashyk_invites i where i.status='pending' and ((i.host_user_id=v_actor and i.friend_user_id=p_friend_user_id) or (i.host_user_id=p_friend_user_id and i.friend_user_id=v_actor))) then raise exception 'invite already pending' using errcode='P0001'; end if;
  insert into public.ashyk_rooms(status,host_user_id,active_user_id,game_state) values('waiting',v_actor,v_actor,coalesce(p_initial_state,'{}'::jsonb)) returning * into v_room;
  insert into public.ashyk_invites(room_id,host_user_id,friend_user_id) values(v_room.id,v_actor,p_friend_user_id) returning * into v_invite;
  return jsonb_build_object('invite',to_jsonb(v_invite),'room',to_jsonb(v_room));
end $$;

create or replace function public.ashyk_invite_accept(p_invite_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_invite public.ashyk_invites;v_room public.ashyk_rooms;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  perform private.expire_ashyk_invites();
  select * into v_invite from public.ashyk_invites where id=p_invite_id for update;
  if v_invite.id is null or v_invite.friend_user_id<>v_actor or v_invite.status<>'pending' or v_invite.expires_at<=now() then raise exception 'invite unavailable' using errcode='42501'; end if;
  if not private.social_are_friends(v_invite.host_user_id,v_actor) or private.social_blocked(v_invite.host_user_id,v_actor) then raise exception 'friend unavailable' using errcode='42501'; end if;
  update public.ashyk_rooms set guest_user_id=v_actor,status='playing',active_user_id=v_invite.host_user_id,revision=revision+1,updated_at=now() where id=v_invite.room_id and status='waiting' returning * into v_room;
  if v_room.id is null then raise exception 'room unavailable' using errcode='P0001'; end if;
  update public.ashyk_invites set status='accepted',accepted_at=now(),updated_at=now() where id=v_invite.id returning * into v_invite;
  return jsonb_build_object('invite',to_jsonb(v_invite),'room',to_jsonb(v_room));
end $$;

create or replace function public.ashyk_invite_decline(p_invite_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_room uuid;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  select room_id into v_room from public.ashyk_invites where id=p_invite_id and friend_user_id=v_actor and status='pending' for update;
  if v_room is null then return; end if;
  update public.ashyk_invites set status='declined',updated_at=now() where id=p_invite_id;
  update public.ashyk_rooms set status='abandoned',revision=revision+1,updated_at=now() where id=v_room and status='waiting';
end $$;

create or replace function public.ashyk_invite_cancel(p_invite_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_room uuid;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  select room_id into v_room from public.ashyk_invites where id=p_invite_id and host_user_id=v_actor and status='pending' for update;
  if v_room is null then return; end if;
  update public.ashyk_invites set status='cancelled',updated_at=now() where id=p_invite_id;
  update public.ashyk_rooms set status='abandoned',revision=revision+1,updated_at=now() where id=v_room and status='waiting';
end $$;

revoke all on function public.ashyk_invite_create(uuid,jsonb) from public,anon;
revoke all on function public.ashyk_invite_accept(uuid) from public,anon;
revoke all on function public.ashyk_invite_decline(uuid) from public,anon;
revoke all on function public.ashyk_invite_cancel(uuid) from public,anon;
grant execute on function public.ashyk_invite_create(uuid,jsonb) to authenticated;
grant execute on function public.ashyk_invite_accept(uuid) to authenticated;
grant execute on function public.ashyk_invite_decline(uuid) to authenticated;
grant execute on function public.ashyk_invite_cancel(uuid) to authenticated;

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='friendships') then alter publication supabase_realtime add table public.friendships; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ashyk_invites') then alter publication supabase_realtime add table public.ashyk_invites; end if;
end $$;

commit;

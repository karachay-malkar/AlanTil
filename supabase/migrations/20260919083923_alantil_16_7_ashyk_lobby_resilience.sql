begin;

alter table public.ashyk_rooms
  add column if not exists host_ready_at timestamptz,
  add column if not exists guest_ready_at timestamptz,
  add column if not exists host_seen_at timestamptz,
  add column if not exists guest_seen_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists ended_at timestamptz;

alter table public.ashyk_rooms drop constraint if exists ashyk_rooms_status_check;
alter table public.ashyk_rooms
  add constraint ashyk_rooms_status_check
  check(status in ('waiting','preparing','playing','finished','abandoned'));

create or replace function private.expire_ashyk_sessions()
returns void language plpgsql security definer set search_path='' as $$
begin
  update public.ashyk_rooms r set status='abandoned',revision=revision+1,ended_at=coalesce(ended_at,now()),updated_at=now()
  from public.ashyk_invites i
  where i.room_id=r.id and i.status='pending' and i.expires_at<=now() and r.status='waiting';

  update public.ashyk_invites set status='expired',updated_at=now()
  where status='pending' and expires_at<=now();

  update public.ashyk_rooms r
  set status='abandoned',revision=revision+1,ended_at=coalesce(ended_at,now()),updated_at=now()
  where r.status in ('waiting','preparing','playing')
    and greatest(
      coalesce(r.host_seen_at,r.updated_at),
      coalesce(r.guest_seen_at,r.updated_at),
      r.updated_at
    ) < now()-interval '30 minutes';
end $$;

create or replace function private.expire_ashyk_invites()
returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.expire_ashyk_sessions();
end $$;

create or replace function public.ashyk_room_get(p_room_id uuid)
returns public.ashyk_rooms language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_room public.ashyk_rooms;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  perform private.expire_ashyk_sessions();
  select * into v_room from public.ashyk_rooms where id=p_room_id;
  if v_room.id is null then raise exception 'room not found' using errcode='P0002'; end if;
  if v_actor<>v_room.host_user_id and v_actor is distinct from v_room.guest_user_id then raise exception 'not a room member' using errcode='42501'; end if;
  return v_room;
end $$;

create or replace function public.ashyk_active_room()
returns setof public.ashyk_rooms language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  perform private.expire_ashyk_sessions();
  return query
    select r.* from public.ashyk_rooms r
    where (r.host_user_id=v_actor or r.guest_user_id=v_actor)
      and r.status in ('waiting','preparing','playing')
    order by r.updated_at desc
    limit 1;
end $$;

create or replace function public.ashyk_room_ready(p_room_id uuid)
returns public.ashyk_rooms language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_room public.ashyk_rooms;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  perform private.expire_ashyk_sessions();
  select * into v_room from public.ashyk_rooms where id=p_room_id for update;
  if v_room.id is null then raise exception 'room not found' using errcode='P0002'; end if;
  if v_actor<>v_room.host_user_id and v_actor is distinct from v_room.guest_user_id then raise exception 'not a room member' using errcode='42501'; end if;
  if v_room.status not in ('waiting','preparing','playing') then return v_room; end if;

  update public.ashyk_rooms
  set host_ready_at=case when v_actor=host_user_id then coalesce(host_ready_at,now()) else host_ready_at end,
      guest_ready_at=case when v_actor=guest_user_id then coalesce(guest_ready_at,now()) else guest_ready_at end,
      host_seen_at=case when v_actor=host_user_id then now() else host_seen_at end,
      guest_seen_at=case when v_actor=guest_user_id then now() else guest_seen_at end,
      updated_at=now()
  where id=p_room_id
  returning * into v_room;

  if v_room.guest_user_id is not null and v_room.host_ready_at is not null and v_room.guest_ready_at is not null and v_room.status<>'playing' then
    update public.ashyk_rooms
    set status='playing',active_user_id=host_user_id,started_at=coalesce(started_at,now()),revision=revision+1,updated_at=now()
    where id=p_room_id
    returning * into v_room;
  end if;
  return v_room;
end $$;

create or replace function public.ashyk_room_ping(p_room_id uuid)
returns public.ashyk_rooms language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_room public.ashyk_rooms;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  perform private.expire_ashyk_sessions();
  select * into v_room from public.ashyk_rooms where id=p_room_id for update;
  if v_room.id is null then raise exception 'room not found' using errcode='P0002'; end if;
  if v_actor<>v_room.host_user_id and v_actor is distinct from v_room.guest_user_id then raise exception 'not a room member' using errcode='42501'; end if;
  if v_room.status not in ('waiting','preparing','playing') then return v_room; end if;
  update public.ashyk_rooms
  set host_seen_at=case when v_actor=host_user_id then now() else host_seen_at end,
      guest_seen_at=case when v_actor=guest_user_id then now() else guest_seen_at end
  where id=p_room_id
  returning * into v_room;
  return v_room;
end $$;

create or replace function public.ashyk_invite_create(p_friend_user_id uuid,p_initial_state jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_room public.ashyk_rooms;v_invite public.ashyk_invites;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  perform private.expire_ashyk_sessions();
  if p_friend_user_id is null or p_friend_user_id=v_actor then raise exception 'invalid friend'; end if;
  if not private.social_are_friends(v_actor,p_friend_user_id) or private.social_blocked(v_actor,p_friend_user_id) then raise exception 'friend unavailable' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ashyk-user:'||least(v_actor::text,p_friend_user_id::text),0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ashyk-user:'||greatest(v_actor::text,p_friend_user_id::text),0));

  select * into v_invite
  from public.ashyk_invites i
  where i.status='pending' and ((i.host_user_id=v_actor and i.friend_user_id=p_friend_user_id) or (i.host_user_id=p_friend_user_id and i.friend_user_id=v_actor))
  order by i.created_at desc limit 1;
  if v_invite.id is not null then
    if v_invite.host_user_id<>v_actor then raise exception 'invite already pending' using errcode='P0001'; end if;
    select * into v_room from public.ashyk_rooms where id=v_invite.room_id;
    return jsonb_build_object('invite',to_jsonb(v_invite),'room',to_jsonb(v_room));
  end if;

  if exists(select 1 from public.ashyk_rooms r where (r.host_user_id=v_actor or r.guest_user_id=v_actor) and r.status in ('waiting','preparing','playing')) then raise exception 'active game exists' using errcode='P0001'; end if;
  if exists(select 1 from public.ashyk_rooms r where (r.host_user_id=p_friend_user_id or r.guest_user_id=p_friend_user_id) and r.status in ('waiting','preparing','playing')) then raise exception 'friend already playing' using errcode='P0001'; end if;

  insert into public.ashyk_rooms(status,host_user_id,active_user_id,game_state,host_seen_at)
  values('waiting',v_actor,v_actor,coalesce(p_initial_state,'{}'::jsonb),now()) returning * into v_room;
  insert into public.ashyk_invites(room_id,host_user_id,friend_user_id) values(v_room.id,v_actor,p_friend_user_id) returning * into v_invite;
  return jsonb_build_object('invite',to_jsonb(v_invite),'room',to_jsonb(v_room));
end $$;

create or replace function public.ashyk_invite_accept(p_invite_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_invite public.ashyk_invites;v_room public.ashyk_rooms;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  perform private.expire_ashyk_sessions();
  select * into v_invite from public.ashyk_invites where id=p_invite_id for update;
  if v_invite.id is null or v_invite.friend_user_id<>v_actor or v_invite.status<>'pending' or v_invite.expires_at<=now() then raise exception 'invite unavailable' using errcode='42501'; end if;
  if not private.social_are_friends(v_invite.host_user_id,v_actor) or private.social_blocked(v_invite.host_user_id,v_actor) then raise exception 'friend unavailable' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ashyk-user:'||least(v_actor::text,v_invite.host_user_id::text),0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ashyk-user:'||greatest(v_actor::text,v_invite.host_user_id::text),0));
  if exists(select 1 from public.ashyk_rooms r where r.id<>v_invite.room_id and (r.host_user_id=v_actor or r.guest_user_id=v_actor) and r.status in ('waiting','preparing','playing')) then raise exception 'active game exists' using errcode='P0001'; end if;

  update public.ashyk_rooms
  set guest_user_id=v_actor,status='preparing',active_user_id=host_user_id,guest_seen_at=now(),revision=revision+1,updated_at=now()
  where id=v_invite.room_id and status='waiting'
  returning * into v_room;
  if v_room.id is null then raise exception 'room unavailable' using errcode='P0001'; end if;
  update public.ashyk_invites set status='accepted',accepted_at=now(),updated_at=now() where id=v_invite.id returning * into v_invite;
  return jsonb_build_object('invite',to_jsonb(v_invite),'room',to_jsonb(v_room));
end $$;

drop function if exists public.ashyk_submit_state(uuid,bigint,jsonb,uuid,text);
create function public.ashyk_submit_state(
  p_room_id uuid,
  p_expected_revision bigint,
  p_state jsonb,
  p_next_active_user_id uuid,
  p_status text default 'playing'
)
returns public.ashyk_rooms language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_room public.ashyk_rooms;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_status not in ('playing','finished') then raise exception 'invalid room status'; end if;
  select * into v_room from public.ashyk_rooms where id=p_room_id for update;
  if v_room.id is null then raise exception 'room not found' using errcode='P0002'; end if;
  if v_actor<>v_room.host_user_id and v_actor is distinct from v_room.guest_user_id then raise exception 'not a room member' using errcode='42501'; end if;
  if v_room.status<>'playing' then raise exception 'room is not playing' using errcode='P0001'; end if;
  if v_actor<>v_room.active_user_id then raise exception 'not your turn' using errcode='42501'; end if;
  if v_room.revision<>p_expected_revision then raise exception 'stale room revision' using errcode='40001'; end if;
  if p_next_active_user_id<>v_room.host_user_id and p_next_active_user_id is distinct from v_room.guest_user_id then raise exception 'invalid next player'; end if;
  update public.ashyk_rooms
  set game_state=coalesce(p_state,'{}'::jsonb),active_user_id=p_next_active_user_id,status=p_status,
      revision=revision+1,
      host_seen_at=case when v_actor=host_user_id then now() else host_seen_at end,
      guest_seen_at=case when v_actor=guest_user_id then now() else guest_seen_at end,
      ended_at=case when p_status='finished' then coalesce(ended_at,now()) else ended_at end,
      updated_at=now()
  where id=p_room_id returning * into v_room;
  return v_room;
end $$;

drop function if exists public.ashyk_leave_room(uuid);
create function public.ashyk_leave_room(p_room_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_room public.ashyk_rooms;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  select * into v_room from public.ashyk_rooms where id=p_room_id for update;
  if v_room.id is null then return; end if;
  if v_actor<>v_room.host_user_id and v_actor is distinct from v_room.guest_user_id then raise exception 'not a room member' using errcode='42501'; end if;
  update public.ashyk_rooms set status='abandoned',revision=revision+1,ended_at=coalesce(ended_at,now()),updated_at=now() where id=p_room_id and status in ('waiting','preparing','playing');
  update public.ashyk_invites set status='cancelled',updated_at=now() where room_id=p_room_id and status='pending';
end $$;

revoke all on function public.ashyk_submit_state(uuid,bigint,jsonb,uuid,text) from public,anon;
revoke all on function public.ashyk_leave_room(uuid) from public,anon;
grant execute on function public.ashyk_submit_state(uuid,bigint,jsonb,uuid,text) to authenticated;
grant execute on function public.ashyk_leave_room(uuid) to authenticated;

revoke all on function public.ashyk_room_get(uuid) from public,anon;
revoke all on function public.ashyk_active_room() from public,anon;
revoke all on function public.ashyk_room_ready(uuid) from public,anon;
revoke all on function public.ashyk_room_ping(uuid) from public,anon;
grant execute on function public.ashyk_room_get(uuid) to authenticated;
grant execute on function public.ashyk_active_room() to authenticated;
grant execute on function public.ashyk_room_ready(uuid) to authenticated;
grant execute on function public.ashyk_room_ping(uuid) to authenticated;

update public.ashyk_rooms
set status='abandoned',ended_at=coalesce(ended_at,now()),revision=revision+1,updated_at=now()
where status in ('waiting','playing') and updated_at<now()-interval '30 minutes';

commit;

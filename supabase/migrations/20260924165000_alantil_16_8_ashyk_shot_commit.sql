begin;

alter table public.ashyk_rooms
  add column if not exists shot_in_flight_id text,
  add column if not exists shot_in_flight_actor_user_id uuid references auth.users(id) on delete set null,
  add column if not exists shot_in_flight_phase_seq bigint,
  add column if not exists shot_committed_at timestamptz,
  add column if not exists shot_result_deadline_at timestamptz;

alter table public.ashyk_rooms alter column protocol_version set default 4;

drop trigger if exists ashyk_rooms_protocol_v3_guard on public.ashyk_rooms;
drop function if exists private.ashyk_enforce_protocol_v3();

create or replace function private.ashyk_enforce_protocol_v4()
returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='INSERT' then
    if new.protocol_version is null or new.protocol_version<4 then new.protocol_version:=4; end if;
  elsif old.protocol_version=4 and new.protocol_version<4 then
    new.protocol_version:=4;
  end if;
  return new;
end;
$$;

drop trigger if exists ashyk_rooms_protocol_v4_guard on public.ashyk_rooms;
create trigger ashyk_rooms_protocol_v4_guard
before insert or update of protocol_version on public.ashyk_rooms
for each row execute function private.ashyk_enforce_protocol_v4();

create or replace function private.ashyk_guard_committed_shot()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.protocol_version>=4 and new.last_action_type='shot_result' and new.phase_seq is distinct from old.phase_seq then
    if old.shot_in_flight_id is null
       or new.last_action_id is distinct from old.shot_in_flight_id
       or new.last_action_actor_user_id is distinct from old.shot_in_flight_actor_user_id
       or old.shot_in_flight_phase_seq is distinct from old.phase_seq then
      raise exception 'shot result does not match committed shot' using errcode='40001';
    end if;
  end if;
  if new.phase_seq is distinct from old.phase_seq or new.status<>'playing' then
    new.shot_in_flight_id:=null;
    new.shot_in_flight_actor_user_id:=null;
    new.shot_in_flight_phase_seq:=null;
    new.shot_committed_at:=null;
    new.shot_result_deadline_at:=null;
  end if;
  return new;
end;
$$;

drop trigger if exists ashyk_rooms_committed_shot_guard on public.ashyk_rooms;
create trigger ashyk_rooms_committed_shot_guard
before update on public.ashyk_rooms
for each row execute function private.ashyk_guard_committed_shot();

create or replace function public.ashyk_shot_commit(p_room_id uuid,p_expected_revision bigint,p_expected_phase_seq bigint,p_shot_id text)
returns public.ashyk_rooms language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid:=auth.uid();
  v_room public.ashyk_rooms;
  v_guard_deadline timestamptz;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  if coalesce(trim(p_shot_id),'')='' or length(p_shot_id)>160 then raise exception 'invalid shot id'; end if;

  select * into v_room from public.ashyk_rooms where id=p_room_id for update;
  if v_room.id is null then raise exception 'room not found' using errcode='P0002'; end if;
  if v_actor<>v_room.host_user_id and v_actor is distinct from v_room.guest_user_id then raise exception 'not a room member' using errcode='42501'; end if;
  if v_room.status<>'playing' or v_room.active_user_id<>v_actor then raise exception 'shot not allowed' using errcode='42501'; end if;
  if v_room.protocol_version<>4 then raise exception 'incompatible Ashyk protocol' using errcode='P0001'; end if;
  if v_room.phase not in ('first-shot','bonus-shot') then raise exception 'shot not allowed in this phase' using errcode='P0001'; end if;

  if v_room.shot_in_flight_id is not null then
    if v_room.shot_in_flight_id=p_shot_id
       and v_room.shot_in_flight_actor_user_id=v_actor
       and v_room.shot_in_flight_phase_seq=v_room.phase_seq then
      return v_room;
    end if;
    raise exception 'another shot is already committed' using errcode='40001';
  end if;

  if v_room.revision<>p_expected_revision then raise exception 'stale room revision' using errcode='40001'; end if;
  if v_room.phase_seq<>p_expected_phase_seq then raise exception 'stale room phase' using errcode='40001'; end if;
  if v_room.phase_deadline_at is not null and v_room.phase_deadline_at<=now() then
    return private.ashyk_resolve_timeout_locked(p_room_id);
  end if;

  v_guard_deadline:=now()+interval '12 seconds';

  update public.ashyk_rooms
  set shot_in_flight_id=p_shot_id,
      shot_in_flight_actor_user_id=v_actor,
      shot_in_flight_phase_seq=phase_seq,
      shot_committed_at=now(),
      shot_result_deadline_at=v_guard_deadline,
      phase_deadline_at=case when phase_deadline_at is null then v_guard_deadline else greatest(v_room.phase_deadline_at,v_guard_deadline) end,
      host_seen_at=case when v_actor=host_user_id then now() else host_seen_at end,
      guest_seen_at=case when v_actor=guest_user_id then now() else guest_seen_at end,
      updated_at=now()
  where id=p_room_id
  returning * into v_room;

  return v_room;
end;
$$;

create or replace function public.ashyk_room_ready(p_room_id uuid) returns public.ashyk_rooms language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_room public.ashyk_rooms;v_state jsonb;begin if v_actor is null then raise exception 'authentication required' using errcode='42501';end if;perform private.expire_ashyk_sessions();select * into v_room from public.ashyk_rooms where id=p_room_id for update;if v_room.id is null then raise exception 'room not found' using errcode='P0002';end if;if v_actor<>v_room.host_user_id and v_actor is distinct from v_room.guest_user_id then raise exception 'not a room member' using errcode='42501';end if;if v_room.status not in ('waiting','preparing','playing') then return v_room;end if;update public.ashyk_rooms set host_ready_at=case when v_actor=host_user_id then coalesce(host_ready_at,now()) else host_ready_at end,guest_ready_at=case when v_actor=guest_user_id then coalesce(guest_ready_at,now()) else guest_ready_at end,host_seen_at=case when v_actor=host_user_id then now() else host_seen_at end,guest_seen_at=case when v_actor=guest_user_id then now() else guest_seen_at end where id=p_room_id returning * into v_room;
if v_room.guest_user_id is not null and v_room.host_ready_at is not null and v_room.guest_ready_at is not null and v_room.host_seen_at>=now()-interval '30 seconds' and v_room.guest_seen_at>=now()-interval '30 seconds' and v_room.status<>'playing' then v_state:=private.ashyk_clean_state(v_room.game_state,'first-shot',1);update public.ashyk_rooms set protocol_version=4,status='playing',active_user_id=host_user_id,game_state=v_state,started_at=coalesce(started_at,now()),turn_no=1,phase='first-shot',phase_seq=greatest(phase_seq,0)+1,phase_started_at=now(),phase_deadline_at=now()+make_interval(secs=>private.ashyk_phase_seconds(v_state,'first-shot')),last_action_id='server-start:'||(greatest(phase_seq,0)+1)::text,last_action_type='start',last_action_actor_user_id=null,revision=revision+1,updated_at=now() where id=p_room_id returning * into v_room;insert into public.ashyk_action_log(room_id,revision_after,phase_seq_after,actor_user_id,action_id,action_type) values(v_room.id,v_room.revision,v_room.phase_seq,null,v_room.last_action_id,'start') on conflict(room_id,action_id) do nothing;end if;return v_room;end $$;

create or replace function public.ashyk_invite_create(p_friend_user_id uuid,p_initial_state jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_room public.ashyk_rooms;v_invite public.ashyk_invites;v_state jsonb;begin if v_actor is null then raise exception 'authentication required' using errcode='42501';end if;perform private.expire_ashyk_sessions();if p_friend_user_id is null or p_friend_user_id=v_actor then raise exception 'invalid friend';end if;if not private.social_are_friends(v_actor,p_friend_user_id) or private.social_blocked(v_actor,p_friend_user_id) then raise exception 'friend unavailable' using errcode='42501';end if;perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ashyk-user:'||least(v_actor::text,p_friend_user_id::text),0));perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ashyk-user:'||greatest(v_actor::text,p_friend_user_id::text),0));select * into v_invite from public.ashyk_invites i where i.status='pending' and ((i.host_user_id=v_actor and i.friend_user_id=p_friend_user_id) or (i.host_user_id=p_friend_user_id and i.friend_user_id=v_actor)) order by i.created_at desc limit 1;if v_invite.id is not null then if v_invite.host_user_id<>v_actor then raise exception 'invite already pending' using errcode='P0001';end if;select * into v_room from public.ashyk_rooms where id=v_invite.room_id;return jsonb_build_object('invite',to_jsonb(v_invite),'room',to_jsonb(v_room));end if;if exists(select 1 from public.ashyk_rooms r where (r.host_user_id=v_actor or r.guest_user_id=v_actor) and r.status in ('waiting','preparing','playing')) then raise exception 'active game exists' using errcode='P0001';end if;if exists(select 1 from public.ashyk_rooms r where (r.host_user_id=p_friend_user_id or r.guest_user_id=p_friend_user_id) and r.status in ('waiting','preparing','playing')) then raise exception 'friend already playing' using errcode='P0001';end if;v_state:=private.ashyk_clean_state(coalesce(p_initial_state,'{}'::jsonb),'first-shot',1);insert into public.ashyk_rooms(protocol_version,status,host_user_id,active_user_id,game_state,turn_no,phase,phase_seq,host_seen_at) values(4,'waiting',v_actor,v_actor,v_state,0,'first-shot',0,now()) returning * into v_room;insert into public.ashyk_invites(room_id,host_user_id,friend_user_id) values(v_room.id,v_actor,p_friend_user_id) returning * into v_invite;return jsonb_build_object('invite',to_jsonb(v_invite),'room',to_jsonb(v_room));end $$;

update public.ashyk_rooms
set status='abandoned',
    ended_at=coalesce(ended_at,now()),
    revision=revision+1,
    finish_reason='protocol_upgrade',
    updated_at=now()
where status in ('waiting','preparing','playing') and protocol_version<4;

revoke all on function public.ashyk_shot_commit(uuid,bigint,bigint,text) from public,anon;
grant execute on function public.ashyk_shot_commit(uuid,bigint,bigint,text) to authenticated;

commit;

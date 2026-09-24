begin;

create or replace function private.ashyk_resolve_timeout_locked(p_room_id uuid)
returns public.ashyk_rooms
language plpgsql
security definer
set search_path=''
as $$
declare
  v_room public.ashyk_rooms;
  v_next uuid;
  v_next_player integer;
  v_action_id text;
  v_state jsonb;
begin
  select * into v_room
  from public.ashyk_rooms
  where id=p_room_id
  for update;

  if v_room.id is null
     or v_room.status<>'playing'
     or v_room.phase_deadline_at is null then
    return v_room;
  end if;

  -- A committed shot has already beaten the turn clock. Ordinary timeout
  -- resolution must never cancel its trajectory or authoritative result.
  if v_room.protocol_version>=4 and v_room.shot_in_flight_id is not null then
    return v_room;
  end if;

  if v_room.phase_deadline_at>now() then
    return v_room;
  end if;

  v_next:=case
    when v_room.active_user_id=v_room.host_user_id then v_room.guest_user_id
    else v_room.host_user_id
  end;
  if v_next is null then return v_room; end if;

  v_next_player:=case when v_next=v_room.host_user_id then 1 else 2 end;
  v_action_id:='server-timeout:'||v_room.phase_seq::text;
  v_state:=private.ashyk_clean_state(v_room.game_state,'first-shot',v_next_player);

  update public.ashyk_rooms
  set game_state=v_state,
      active_user_id=v_next,
      revision=revision+1,
      turn_no=turn_no+1,
      phase='first-shot',
      phase_seq=phase_seq+1,
      phase_started_at=now(),
      phase_deadline_at=now()+make_interval(secs=>private.ashyk_phase_seconds(v_state,'first-shot')),
      last_action_id=v_action_id,
      last_action_type='timeout',
      last_action_actor_user_id=null,
      updated_at=now()
  where id=p_room_id
  returning * into v_room;

  insert into public.ashyk_action_log(
    room_id,revision_after,phase_seq_after,actor_user_id,action_id,action_type
  ) values(
    v_room.id,v_room.revision,v_room.phase_seq,null,v_action_id,'timeout'
  ) on conflict(room_id,action_id) do nothing;

  return v_room;
end
$$;

create or replace function public.ashyk_shot_commit(
  p_room_id uuid,
  p_expected_revision bigint,
  p_expected_phase_seq bigint,
  p_shot_id text
)
returns public.ashyk_rooms
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_room public.ashyk_rooms;
  v_guard_deadline timestamptz;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  if coalesce(trim(p_shot_id),'')='' or length(p_shot_id)>160 then raise exception 'invalid shot id'; end if;

  select * into v_room
  from public.ashyk_rooms
  where id=p_room_id
  for update;

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

  v_guard_deadline:=now()+interval '30 seconds';

  update public.ashyk_rooms
  set shot_in_flight_id=p_shot_id,
      shot_in_flight_actor_user_id=v_actor,
      shot_in_flight_phase_seq=phase_seq,
      shot_committed_at=now(),
      shot_result_deadline_at=v_guard_deadline,
      phase_deadline_at=null,
      host_seen_at=case when v_actor=host_user_id then now() else host_seen_at end,
      guest_seen_at=case when v_actor=guest_user_id then now() else guest_seen_at end,
      updated_at=now()
  where id=p_room_id
  returning * into v_room;

  return v_room;
end
$$;

revoke all on function public.ashyk_shot_commit(uuid,bigint,bigint,text) from public,anon;
grant execute on function public.ashyk_shot_commit(uuid,bigint,bigint,text) to authenticated;

commit;

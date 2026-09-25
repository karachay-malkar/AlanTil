begin;

-- Online Ashyk now has one room model. protocol_version remains only as inert
-- legacy metadata so already-open 16.8 clients can finish/rejoin safely.
update public.ashyk_rooms set protocol_version=4 where protocol_version is distinct from 4;
alter table public.ashyk_rooms alter column protocol_version set default 4;

drop trigger if exists ashyk_rooms_protocol_v4_guard on public.ashyk_rooms;
drop trigger if exists ashyk_rooms_protocol_v3_guard on public.ashyk_rooms;
drop function if exists private.ashyk_enforce_protocol_v4();
drop function if exists private.ashyk_enforce_protocol_v3();

update public.ashyk_rooms
set status='waiting',revision=revision+1,updated_at=now()
where status='preparing';

alter table public.ashyk_rooms drop constraint if exists ashyk_rooms_status_check;
alter table public.ashyk_rooms
  add constraint ashyk_rooms_status_check
  check(status in ('waiting','playing','finished','abandoned'));

-- Heal any historical duplicate active rooms before installing the hard guard.
do $$
declare
  v_room_id uuid;
begin
  loop
    select ranked.id into v_room_id
    from (
      select r.id,
             row_number() over (
               partition by participant.user_id
               order by case when r.status='playing' then 0 else 1 end,
                        r.updated_at desc,
                        r.created_at desc,
                        r.id
             ) as rn
      from public.ashyk_rooms r
      cross join lateral (
        values (r.host_user_id),(r.guest_user_id)
      ) participant(user_id)
      where r.status in ('waiting','playing')
        and participant.user_id is not null
    ) ranked
    where ranked.rn>1
    limit 1;

    exit when v_room_id is null;

    update public.ashyk_rooms
    set status='abandoned',
        ended_at=coalesce(ended_at,now()),
        revision=revision+1,
        finish_reason=coalesce(finish_reason,'duplicate_active_room_cleanup'),
        phase_deadline_at=null,
        updated_at=now()
    where id=v_room_id and status in ('waiting','playing');
  end loop;
end
$$;

create or replace function private.ashyk_single_active_room_guard()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  v_first uuid;
  v_second uuid;
begin
  if new.status not in ('waiting','playing') then
    return new;
  end if;

  v_first:=new.host_user_id;
  v_second:=new.guest_user_id;

  if v_second is null or v_first::text<=v_second::text then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ashyk-user:'||v_first::text,0));
    if v_second is not null then
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ashyk-user:'||v_second::text,0));
    end if;
  else
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ashyk-user:'||v_second::text,0));
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ashyk-user:'||v_first::text,0));
  end if;

  if exists(
    select 1
    from public.ashyk_rooms r
    where r.id<>new.id
      and r.status in ('waiting','playing')
      and (
        r.host_user_id=new.host_user_id
        or r.guest_user_id=new.host_user_id
        or (
          new.guest_user_id is not null
          and (r.host_user_id=new.guest_user_id or r.guest_user_id=new.guest_user_id)
        )
      )
  ) then
    raise exception 'active game exists' using errcode='P0001';
  end if;

  return new;
end
$$;

drop trigger if exists ashyk_rooms_single_active_guard on public.ashyk_rooms;
create trigger ashyk_rooms_single_active_guard
before insert or update of status,host_user_id,guest_user_id
on public.ashyk_rooms
for each row execute function private.ashyk_single_active_room_guard();

-- Remove stale pending invitations that conflict with an already-active room.
with invalid_invites as (
  update public.ashyk_invites i
  set status='cancelled',updated_at=now()
  where i.status='pending'
    and exists(
      select 1
      from public.ashyk_rooms r
      where r.status in ('waiting','playing')
        and r.id<>i.room_id
        and (
          r.host_user_id in (i.host_user_id,i.friend_user_id)
          or r.guest_user_id in (i.host_user_id,i.friend_user_id)
        )
    )
  returning i.room_id
)
update public.ashyk_rooms r
set status='abandoned',
    ended_at=coalesce(r.ended_at,now()),
    revision=r.revision+1,
    updated_at=now()
where r.id in (select room_id from invalid_invites)
  and r.status='waiting';

create index if not exists ashyk_rooms_host_status_idx
  on public.ashyk_rooms(host_user_id,status,updated_at desc);
create index if not exists ashyk_rooms_guest_status_idx
  on public.ashyk_rooms(guest_user_id,status,updated_at desc)
  where guest_user_id is not null;
create index if not exists ashyk_rooms_finished_pair_idx
  on public.ashyk_rooms(host_user_id,guest_user_id,ended_at desc)
  where status='finished';

create or replace function private.ashyk_phase_seconds(p_state jsonb,p_phase text)
returns integer
language sql
immutable
set search_path=''
as $$
  select case when p_phase='bonus-question' then 10 else 20 end
$$;

create or replace function private.ashyk_guard_committed_shot()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if new.last_action_type='shot_result' and new.phase_seq is distinct from old.phase_seq then
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
end
$$;

drop trigger if exists ashyk_rooms_committed_shot_guard on public.ashyk_rooms;
create trigger ashyk_rooms_committed_shot_guard
before update on public.ashyk_rooms
for each row execute function private.ashyk_guard_committed_shot();

create or replace function private.expire_ashyk_sessions()
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  update public.ashyk_rooms r
  set status='abandoned',
      revision=revision+1,
      ended_at=coalesce(ended_at,now()),
      updated_at=now()
  from public.ashyk_invites i
  where i.room_id=r.id
    and i.status='pending'
    and i.expires_at<=now()
    and r.status='waiting';

  update public.ashyk_invites
  set status='expired',updated_at=now()
  where status='pending' and expires_at<=now();

  update public.ashyk_rooms r
  set status='abandoned',
      revision=revision+1,
      ended_at=coalesce(ended_at,now()),
      updated_at=now()
  where r.status in ('waiting','playing')
    and greatest(
      coalesce(r.host_seen_at,r.updated_at),
      coalesce(r.guest_seen_at,r.updated_at),
      r.updated_at
    ) < now()-interval '30 minutes';
end
$$;

create or replace function private.expire_ashyk_invites()
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  perform private.expire_ashyk_sessions();
end
$$;

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

  -- A committed shot has already beaten the turn clock.
  if v_room.shot_in_flight_id is not null then
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

create or replace function public.ashyk_room_get(p_room_id uuid)
returns public.ashyk_rooms
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_room public.ashyk_rooms;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  perform private.expire_ashyk_sessions();

  select * into v_room from public.ashyk_rooms where id=p_room_id;
  if v_room.id is null then raise exception 'room not found' using errcode='P0002'; end if;
  if v_actor<>v_room.host_user_id and v_actor is distinct from v_room.guest_user_id then
    raise exception 'not a room member' using errcode='42501';
  end if;

  if v_room.status='playing' then
    v_room:=private.ashyk_resolve_timeout_locked(p_room_id);
  end if;
  return v_room;
end
$$;

create or replace function public.ashyk_active_room()
returns setof public.ashyk_rooms
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_room public.ashyk_rooms;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  perform private.expire_ashyk_sessions();

  select * into v_room
  from public.ashyk_rooms r
  where (r.host_user_id=v_actor or r.guest_user_id=v_actor)
    and r.status in ('waiting','playing')
  order by case when r.status='playing' then 0 else 1 end,r.updated_at desc
  limit 1;

  if v_room.id is null then return; end if;

  if v_room.status='playing' then
    v_room:=private.ashyk_resolve_timeout_locked(v_room.id);
  end if;

  if v_room.status in ('waiting','playing') then
    return next v_room;
  end if;
end
$$;

create or replace function public.ashyk_room_ping(p_room_id uuid)
returns public.ashyk_rooms
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_room public.ashyk_rooms;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  perform private.expire_ashyk_sessions();

  select * into v_room from public.ashyk_rooms where id=p_room_id;
  if v_room.id is null then raise exception 'room not found' using errcode='P0002'; end if;
  if v_actor<>v_room.host_user_id and v_actor is distinct from v_room.guest_user_id then
    raise exception 'not a room member' using errcode='42501';
  end if;

  if v_room.status='playing' then
    v_room:=private.ashyk_resolve_timeout_locked(p_room_id);
  end if;
  if v_room.status not in ('waiting','playing') then return v_room; end if;

  update public.ashyk_rooms
  set host_seen_at=case when v_actor=host_user_id then now() else host_seen_at end,
      guest_seen_at=case when v_actor=guest_user_id then now() else guest_seen_at end
  where id=p_room_id
  returning * into v_room;

  return v_room;
end
$$;

create or replace function public.ashyk_room_ready(p_room_id uuid)
returns public.ashyk_rooms
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_room public.ashyk_rooms;
  v_state jsonb;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  perform private.expire_ashyk_sessions();

  select * into v_room
  from public.ashyk_rooms
  where id=p_room_id
  for update;

  if v_room.id is null then raise exception 'room not found' using errcode='P0002'; end if;
  if v_actor<>v_room.host_user_id and v_actor is distinct from v_room.guest_user_id then
    raise exception 'not a room member' using errcode='42501';
  end if;
  if v_room.status not in ('waiting','playing') then return v_room; end if;

  update public.ashyk_rooms
  set host_ready_at=case when v_actor=host_user_id then coalesce(host_ready_at,now()) else host_ready_at end,
      guest_ready_at=case when v_actor=guest_user_id then coalesce(guest_ready_at,now()) else guest_ready_at end,
      host_seen_at=case when v_actor=host_user_id then now() else host_seen_at end,
      guest_seen_at=case when v_actor=guest_user_id then now() else guest_seen_at end
  where id=p_room_id
  returning * into v_room;

  if v_room.status='waiting'
     and v_room.guest_user_id is not null
     and v_room.host_ready_at is not null
     and v_room.guest_ready_at is not null
     and v_room.host_seen_at>=now()-interval '30 seconds'
     and v_room.guest_seen_at>=now()-interval '30 seconds' then
    v_state:=private.ashyk_clean_state(v_room.game_state,'first-shot',1);

    update public.ashyk_rooms
    set status='playing',
        active_user_id=host_user_id,
        game_state=v_state,
        started_at=coalesce(started_at,now()),
        turn_no=1,
        phase='first-shot',
        phase_seq=greatest(phase_seq,0)+1,
        phase_started_at=now(),
        phase_deadline_at=now()+make_interval(secs=>private.ashyk_phase_seconds(v_state,'first-shot')),
        last_action_id='server-start:'||(greatest(phase_seq,0)+1)::text,
        last_action_type='start',
        last_action_actor_user_id=null,
        revision=revision+1,
        updated_at=now()
    where id=p_room_id
    returning * into v_room;

    insert into public.ashyk_action_log(
      room_id,revision_after,phase_seq_after,actor_user_id,action_id,action_type
    ) values(
      v_room.id,v_room.revision,v_room.phase_seq,null,v_room.last_action_id,'start'
    ) on conflict(room_id,action_id) do nothing;
  end if;

  return v_room;
end
$$;

create or replace function public.ashyk_invite_create(
  p_friend_user_id uuid,
  p_initial_state jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_room public.ashyk_rooms;
  v_invite public.ashyk_invites;
  v_state jsonb;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  perform private.expire_ashyk_sessions();

  if p_friend_user_id is null or p_friend_user_id=v_actor then
    raise exception 'invalid friend';
  end if;
  if not private.social_are_friends(v_actor,p_friend_user_id)
     or private.social_blocked(v_actor,p_friend_user_id) then
    raise exception 'friend unavailable' using errcode='42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('ashyk-user:'||least(v_actor::text,p_friend_user_id::text),0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('ashyk-user:'||greatest(v_actor::text,p_friend_user_id::text),0)
  );

  select * into v_invite
  from public.ashyk_invites i
  where i.status='pending'
    and (
      (i.host_user_id=v_actor and i.friend_user_id=p_friend_user_id)
      or (i.host_user_id=p_friend_user_id and i.friend_user_id=v_actor)
    )
  order by i.created_at desc
  limit 1;

  if v_invite.id is not null then
    if v_invite.host_user_id<>v_actor then
      raise exception 'invite already pending' using errcode='P0001';
    end if;
    select * into v_room
    from public.ashyk_rooms
    where id=v_invite.room_id and status='waiting';

    if v_room.id is not null then
      return jsonb_build_object('invite',to_jsonb(v_invite),'room',to_jsonb(v_room));
    end if;

    update public.ashyk_invites
    set status='cancelled',updated_at=now()
    where id=v_invite.id and status='pending';
  end if;

  if exists(
    select 1 from public.ashyk_rooms r
    where (r.host_user_id=v_actor or r.guest_user_id=v_actor)
      and r.status in ('waiting','playing')
  ) then
    raise exception 'active game exists' using errcode='P0001';
  end if;

  if exists(
    select 1 from public.ashyk_rooms r
    where (r.host_user_id=p_friend_user_id or r.guest_user_id=p_friend_user_id)
      and r.status in ('waiting','playing')
  ) then
    raise exception 'friend already playing' using errcode='P0001';
  end if;

  v_state:=private.ashyk_clean_state(coalesce(p_initial_state,'{}'::jsonb)-'difficulty','first-shot',1);

  insert into public.ashyk_rooms(
    status,host_user_id,active_user_id,game_state,turn_no,phase,phase_seq,host_seen_at
  ) values(
    'waiting',v_actor,v_actor,v_state,0,'first-shot',0,now()
  ) returning * into v_room;

  insert into public.ashyk_invites(room_id,host_user_id,friend_user_id)
  values(v_room.id,v_actor,p_friend_user_id)
  returning * into v_invite;

  -- Becoming an active host makes every older pending invitation involving
  -- the actor non-actionable. Close them now instead of exposing dead actions.
  with cancelled as (
    update public.ashyk_invites
    set status='cancelled',updated_at=now()
    where id<>v_invite.id
      and status='pending'
      and (host_user_id=v_actor or friend_user_id=v_actor)
    returning room_id
  )
  update public.ashyk_rooms r
  set status='abandoned',
      ended_at=coalesce(r.ended_at,now()),
      revision=r.revision+1,
      updated_at=now()
  where r.id in (select room_id from cancelled)
    and r.id<>v_room.id
    and r.status='waiting';

  return jsonb_build_object('invite',to_jsonb(v_invite),'room',to_jsonb(v_room));
end
$$;

create or replace function public.ashyk_invite_accept(p_invite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_invite public.ashyk_invites;
  v_room public.ashyk_rooms;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  perform private.expire_ashyk_sessions();

  select * into v_invite
  from public.ashyk_invites
  where id=p_invite_id
  for update;

  if v_invite.id is null
     or v_invite.friend_user_id<>v_actor
     or v_invite.status<>'pending'
     or v_invite.expires_at<=now() then
    raise exception 'invite unavailable' using errcode='42501';
  end if;

  if not private.social_are_friends(v_invite.host_user_id,v_actor)
     or private.social_blocked(v_invite.host_user_id,v_actor) then
    raise exception 'friend unavailable' using errcode='42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('ashyk-user:'||least(v_actor::text,v_invite.host_user_id::text),0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('ashyk-user:'||greatest(v_actor::text,v_invite.host_user_id::text),0)
  );

  if exists(
    select 1 from public.ashyk_rooms r
    where r.id<>v_invite.room_id
      and (r.host_user_id=v_actor or r.guest_user_id=v_actor)
      and r.status in ('waiting','playing')
  ) then
    raise exception 'active game exists' using errcode='P0001';
  end if;

  if exists(
    select 1 from public.ashyk_rooms r
    where r.id<>v_invite.room_id
      and (r.host_user_id=v_invite.host_user_id or r.guest_user_id=v_invite.host_user_id)
      and r.status in ('waiting','playing')
  ) then
    raise exception 'friend already playing' using errcode='P0001';
  end if;

  update public.ashyk_rooms
  set guest_user_id=v_actor,
      status='waiting',
      active_user_id=host_user_id,
      guest_seen_at=now(),
      revision=revision+1,
      updated_at=now()
  where id=v_invite.room_id and status='waiting' and guest_user_id is null
  returning * into v_room;

  if v_room.id is null then
    raise exception 'room unavailable' using errcode='P0001';
  end if;

  update public.ashyk_invites
  set status='accepted',accepted_at=now(),updated_at=now()
  where id=v_invite.id
  returning * into v_invite;

  with cancelled as (
    update public.ashyk_invites
    set status='cancelled',updated_at=now()
    where id<>v_invite.id
      and status='pending'
      and (
        host_user_id in (v_actor,v_invite.host_user_id)
        or friend_user_id in (v_actor,v_invite.host_user_id)
      )
    returning room_id
  )
  update public.ashyk_rooms r
  set status='abandoned',
      ended_at=coalesce(r.ended_at,now()),
      revision=r.revision+1,
      updated_at=now()
  where r.id in (select room_id from cancelled)
    and r.id<>v_room.id
    and r.status='waiting';

  return jsonb_build_object('invite',to_jsonb(v_invite),'room',to_jsonb(v_room));
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
  if coalesce(trim(p_shot_id),'')='' or length(p_shot_id)>160 then
    raise exception 'invalid shot id';
  end if;

  select * into v_room
  from public.ashyk_rooms
  where id=p_room_id
  for update;

  if v_room.id is null then raise exception 'room not found' using errcode='P0002'; end if;
  if v_actor<>v_room.host_user_id and v_actor is distinct from v_room.guest_user_id then
    raise exception 'not a room member' using errcode='42501';
  end if;
  if v_room.status<>'playing' or v_room.active_user_id<>v_actor then
    raise exception 'shot not allowed' using errcode='42501';
  end if;
  if v_room.phase not in ('first-shot','bonus-shot') then
    raise exception 'shot not allowed in this phase' using errcode='P0001';
  end if;

  if v_room.shot_in_flight_id is not null then
    if v_room.shot_in_flight_id=p_shot_id
       and v_room.shot_in_flight_actor_user_id=v_actor
       and v_room.shot_in_flight_phase_seq=v_room.phase_seq then
      return v_room;
    end if;
    raise exception 'another shot is already committed' using errcode='40001';
  end if;

  if v_room.revision<>p_expected_revision then
    raise exception 'stale room revision' using errcode='40001';
  end if;
  if v_room.phase_seq<>p_expected_phase_seq then
    raise exception 'stale room phase' using errcode='40001';
  end if;
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

create or replace function public.ashyk_leave_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_room public.ashyk_rooms;
  v_winner uuid;
  v_winner_player integer;
  v_state jsonb;
  v_action text;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;

  select * into v_room
  from public.ashyk_rooms
  where id=p_room_id
  for update;

  if v_room.id is null then return; end if;
  if v_actor<>v_room.host_user_id and v_actor is distinct from v_room.guest_user_id then
    raise exception 'not a room member' using errcode='42501';
  end if;

  if v_room.status='playing' and v_room.guest_user_id is not null then
    v_winner:=case when v_actor=v_room.host_user_id then v_room.guest_user_id else v_room.host_user_id end;
    v_winner_player:=case when v_winner=v_room.host_user_id then 1 else 2 end;
    v_state:=(v_room.game_state-'shotSeconds'-'questionSeconds'-'difficulty')
      ||jsonb_build_object('winner',v_winner_player,'phase',v_room.phase);
    v_action:='server-resign:'||(v_room.revision+1)::text;

    update public.ashyk_rooms
    set status='finished',
        game_state=v_state,
        winner_user_id=v_winner,
        finish_reason='resign',
        revision=revision+1,
        phase_seq=phase_seq+1,
        phase_deadline_at=null,
        last_action_id=v_action,
        last_action_type='resign',
        last_action_actor_user_id=v_actor,
        ended_at=coalesce(ended_at,now()),
        updated_at=now()
    where id=p_room_id;
  elsif v_room.status='waiting' then
    update public.ashyk_rooms
    set status='abandoned',
        revision=revision+1,
        ended_at=coalesce(ended_at,now()),
        updated_at=now()
    where id=p_room_id;
  end if;

  update public.ashyk_invites
  set status='cancelled',updated_at=now()
  where room_id=p_room_id and status='pending';
end
$$;

create or replace function public.ashyk_players_snapshot()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_result jsonb;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  perform private.expire_ashyk_sessions();

  with accepted as (
    select case when f.requester_id=v_actor then f.addressee_id else f.requester_id end as user_id
    from public.friendships f
    where f.status='accepted'
      and (f.requester_id=v_actor or f.addressee_id=v_actor)
  ), friends as (
    select a.user_id,p.nickname,p.avatar_gender
    from accepted a
    join public.profiles p on p.user_id=a.user_id
    where not private.social_blocked(v_actor,a.user_id)
  ), actor_active as (
    select r.*
    from public.ashyk_rooms r
    where (r.host_user_id=v_actor or r.guest_user_id=v_actor)
      and r.status in ('waiting','playing')
    order by case when r.status='playing' then 0 else 1 end,r.updated_at desc
    limit 1
  ), player_rows as (
    select
      f.user_id,
      f.nickname,
      f.avatar_gender,
      coalesce((
        select count(*)::int
        from public.ashyk_rooms r
        where r.status='finished'
          and r.winner_user_id=v_actor
          and (
            (r.host_user_id=v_actor and r.guest_user_id=f.user_id)
            or (r.host_user_id=f.user_id and r.guest_user_id=v_actor)
          )
      ),0) as wins,
      coalesce((
        select count(*)::int
        from public.ashyk_rooms r
        where r.status='finished'
          and r.winner_user_id=f.user_id
          and (
            (r.host_user_id=v_actor and r.guest_user_id=f.user_id)
            or (r.host_user_id=f.user_id and r.guest_user_id=v_actor)
          )
      ),0) as losses,
      (
        select r.id
        from public.ashyk_rooms r
        where r.status in ('waiting','playing')
          and (
            (r.host_user_id=v_actor and r.guest_user_id=f.user_id)
            or (r.host_user_id=f.user_id and r.guest_user_id=v_actor)
          )
        order by case when r.status='playing' then 0 else 1 end,r.updated_at desc
        limit 1
      ) as shared_room_id,
      (
        select r.status
        from public.ashyk_rooms r
        where r.status in ('waiting','playing')
          and (
            (r.host_user_id=v_actor and r.guest_user_id=f.user_id)
            or (r.host_user_id=f.user_id and r.guest_user_id=v_actor)
          )
        order by case when r.status='playing' then 0 else 1 end,r.updated_at desc
        limit 1
      ) as shared_room_status,
      (
        select i.id
        from public.ashyk_invites i
        where i.friend_user_id=v_actor
          and i.host_user_id=f.user_id
          and i.status='pending'
          and i.expires_at>now()
        order by i.created_at desc
        limit 1
      ) as incoming_invite_id,
      (
        select i.id
        from public.ashyk_invites i
        where i.host_user_id=v_actor
          and i.friend_user_id=f.user_id
          and i.status='pending'
          and i.expires_at>now()
        order by i.created_at desc
        limit 1
      ) as outgoing_invite_id,
      (
        select i.room_id
        from public.ashyk_invites i
        where i.host_user_id=v_actor
          and i.friend_user_id=f.user_id
          and i.status='pending'
          and i.expires_at>now()
        order by i.created_at desc
        limit 1
      ) as outgoing_room_id,
      exists(
        select 1
        from public.ashyk_rooms r
        where (r.host_user_id=f.user_id or r.guest_user_id=f.user_id)
          and r.status in ('waiting','playing')
          and not (
            (r.host_user_id=v_actor and r.guest_user_id=f.user_id)
            or (r.host_user_id=f.user_id and r.guest_user_id=v_actor)
          )
      ) as friend_busy,
      exists(select 1 from actor_active) as actor_busy
    from friends f
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'user_id',r.user_id,
      'nickname',r.nickname,
      'avatar_gender',r.avatar_gender,
      'wins',r.wins,
      'losses',r.losses,
      'game_status',
        case
          when r.shared_room_status='playing' then 'playing'
          when r.shared_room_status='waiting' then 'waiting'
          when r.incoming_invite_id is not null then 'incoming'
          when r.outgoing_invite_id is not null then 'outgoing'
          when r.actor_busy then 'none'
          when r.friend_busy then 'busy'
          else 'none'
        end,
      'action',
        case
          when r.shared_room_status in ('waiting','playing') then 'resume'
          when r.incoming_invite_id is not null then 'accept'
          when r.outgoing_invite_id is not null then 'cancel'
          when r.actor_busy or r.friend_busy then 'none'
          else 'challenge'
        end,
      'invite_id',coalesce(r.incoming_invite_id,r.outgoing_invite_id),
      'room_id',coalesce(r.shared_room_id,r.outgoing_room_id),
      'is_busy',r.friend_busy
    )
    order by lower(r.nickname),r.user_id
  ),'[]'::jsonb)
  into v_result
  from player_rows r;

  return v_result;
end
$$;

revoke all on function public.ashyk_players_snapshot() from public,anon;
grant execute on function public.ashyk_players_snapshot() to authenticated;

revoke all on function public.ashyk_room_get(uuid) from public,anon;
revoke all on function public.ashyk_active_room() from public,anon;
revoke all on function public.ashyk_room_ping(uuid) from public,anon;
revoke all on function public.ashyk_room_ready(uuid) from public,anon;
revoke all on function public.ashyk_invite_create(uuid,jsonb) from public,anon;
revoke all on function public.ashyk_invite_accept(uuid) from public,anon;
revoke all on function public.ashyk_shot_commit(uuid,bigint,bigint,text) from public,anon;
revoke all on function public.ashyk_leave_room(uuid) from public,anon;

grant execute on function public.ashyk_room_get(uuid) to authenticated;
grant execute on function public.ashyk_active_room() to authenticated;
grant execute on function public.ashyk_room_ping(uuid) to authenticated;
grant execute on function public.ashyk_room_ready(uuid) to authenticated;
grant execute on function public.ashyk_invite_create(uuid,jsonb) to authenticated;
grant execute on function public.ashyk_invite_accept(uuid) to authenticated;
grant execute on function public.ashyk_shot_commit(uuid,bigint,bigint,text) to authenticated;
grant execute on function public.ashyk_leave_room(uuid) to authenticated;

commit;

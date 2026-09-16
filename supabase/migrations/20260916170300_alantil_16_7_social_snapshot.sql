begin;

create or replace function public.social_friends_snapshot()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_result jsonb;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  perform private.expire_ashyk_invites();
  with accepted as (
    select f.id,case when f.requester_id=v_actor then f.addressee_id else f.requester_id end user_id
    from public.friendships f where f.status='accepted' and (f.requester_id=v_actor or f.addressee_id=v_actor)
  ), accepted_rows as (
    select a.id,p.user_id,p.nickname,p.avatar_gender,coalesce(s.rating_score,0) rating_score,
      private.social_streak(p.user_id) streak_days,private.social_story_progress(p.user_id) story_progress
    from accepted a join public.profiles p on p.user_id=a.user_id left join public.user_social_stats s on s.user_id=p.user_id
    where not private.social_blocked(v_actor,p.user_id)
  ), incoming as (
    select f.id,p.user_id,p.nickname,p.avatar_gender,coalesce(s.rating_score,0) rating_score
    from public.friendships f join public.profiles p on p.user_id=f.requester_id left join public.user_social_stats s on s.user_id=p.user_id
    where f.addressee_id=v_actor and f.status='pending' and not private.social_blocked(v_actor,p.user_id)
  ), outgoing as (
    select f.id,p.user_id,p.nickname,p.avatar_gender,coalesce(s.rating_score,0) rating_score
    from public.friendships f join public.profiles p on p.user_id=f.addressee_id left join public.user_social_stats s on s.user_id=p.user_id
    where f.requester_id=v_actor and f.status='pending' and not private.social_blocked(v_actor,p.user_id)
  ), blocked as (
    select p.user_id,p.nickname,p.avatar_gender from public.user_blocks b join public.profiles p on p.user_id=b.blocked_id where b.blocker_id=v_actor
  ), received_invites as (
    select i.id,i.room_id,i.created_at,i.expires_at,p.user_id,p.nickname,p.avatar_gender,coalesce(s.rating_score,0) rating_score
    from public.ashyk_invites i join public.profiles p on p.user_id=i.host_user_id left join public.user_social_stats s on s.user_id=p.user_id
    where i.friend_user_id=v_actor and i.status='pending' and i.expires_at>now()
  ), sent_invites as (
    select i.id,i.room_id,i.created_at,i.expires_at,p.user_id,p.nickname,p.avatar_gender,coalesce(s.rating_score,0) rating_score
    from public.ashyk_invites i join public.profiles p on p.user_id=i.friend_user_id left join public.user_social_stats s on s.user_id=p.user_id
    where i.host_user_id=v_actor and i.status='pending' and i.expires_at>now()
  )
  select jsonb_build_object(
    'friends',coalesce((select jsonb_agg(jsonb_build_object('friendship_id',id,'user_id',user_id,'nickname',nickname,'avatar_gender',avatar_gender,'rating_score',rating_score,'streak_days',streak_days,'story_progress',story_progress) order by nickname) from accepted_rows),'[]'::jsonb),
    'incoming',coalesce((select jsonb_agg(jsonb_build_object('friendship_id',id,'user_id',user_id,'nickname',nickname,'avatar_gender',avatar_gender,'rating_score',rating_score) order by nickname) from incoming),'[]'::jsonb),
    'outgoing',coalesce((select jsonb_agg(jsonb_build_object('friendship_id',id,'user_id',user_id,'nickname',nickname,'avatar_gender',avatar_gender,'rating_score',rating_score) order by nickname) from outgoing),'[]'::jsonb),
    'blocked',coalesce((select jsonb_agg(jsonb_build_object('user_id',user_id,'nickname',nickname,'avatar_gender',avatar_gender) order by nickname) from blocked),'[]'::jsonb),
    'ashyk_invites',coalesce((select jsonb_agg(jsonb_build_object('invite_id',id,'room_id',room_id,'created_at',created_at,'expires_at',expires_at,'user_id',user_id,'nickname',nickname,'avatar_gender',avatar_gender,'rating_score',rating_score) order by created_at desc) from received_invites),'[]'::jsonb),
    'ashyk_sent',coalesce((select jsonb_agg(jsonb_build_object('invite_id',id,'room_id',room_id,'created_at',created_at,'expires_at',expires_at,'user_id',user_id,'nickname',nickname,'avatar_gender',avatar_gender,'rating_score',rating_score) order by created_at desc) from sent_invites),'[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;

create or replace function public.social_inbox_counts()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_requests int:=0;v_invites int:=0;
begin
  if v_actor is null then return jsonb_build_object('friend_requests',0,'ashyk_invites',0,'total',0); end if;
  perform private.expire_ashyk_invites();
  select count(*)::int into v_requests from public.friendships f where f.addressee_id=v_actor and f.status='pending';
  select count(*)::int into v_invites from public.ashyk_invites i where i.friend_user_id=v_actor and i.status='pending' and i.expires_at>now();
  return jsonb_build_object('friend_requests',v_requests,'ashyk_invites',v_invites,'total',v_requests+v_invites);
end $$;

revoke all on function public.social_friends_snapshot() from public,anon;
revoke all on function public.social_inbox_counts() from public,anon;
grant execute on function public.social_friends_snapshot() to authenticated;
grant execute on function public.social_inbox_counts() to authenticated;

commit;

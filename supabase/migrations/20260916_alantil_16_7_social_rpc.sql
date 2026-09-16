begin;

create or replace function public.social_search_users(p_query text default '',p_limit integer default 30)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_result jsonb;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id',x.user_id,'nickname',x.nickname,'avatar_gender',x.avatar_gender,'rating_score',x.rating_score,'relation',x.relation) order by x.rating_score desc,x.nickname,x.user_id),'[]'::jsonb) into v_result
  from (
    select p.user_id,p.nickname,p.avatar_gender,coalesce(s.rating_score,0) rating_score,private.social_relation(v_actor,p.user_id) relation
    from public.profiles p left join public.user_social_stats s on s.user_id=p.user_id
    where p.user_id<>v_actor and not private.social_blocked(v_actor,p.user_id)
      and (btrim(coalesce(p_query,''))='' or p.nickname ilike '%'||btrim(p_query)||'%')
    order by coalesce(s.rating_score,0) desc,p.nickname,p.user_id
    limit least(100,greatest(1,coalesce(p_limit,30)))
  ) x;
  return v_result;
end $$;

create or replace function public.social_leaderboard(p_limit integer default 100,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_result jsonb;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  with ranked as (
    select p.user_id,p.nickname,p.avatar_gender,coalesce(s.rating_score,0)::numeric(12,2) rating_score,dense_rank() over(order by coalesce(s.rating_score,0) desc)::int rank
    from public.profiles p left join public.user_social_stats s on s.user_id=p.user_id
  ),visible as (
    select r.*,private.social_relation(v_actor,r.user_id) relation from ranked r
    where r.user_id=v_actor or not private.social_blocked(v_actor,r.user_id)
    order by r.rank,r.nickname,r.user_id
    limit least(200,greatest(1,coalesce(p_limit,100))) offset greatest(0,coalesce(p_offset,0))
  )
  select coalesce(jsonb_agg(jsonb_build_object('rank',rank,'user_id',user_id,'nickname',nickname,'avatar_gender',avatar_gender,'rating_score',rating_score,'relation',relation) order by rank,nickname,user_id),'[]'::jsonb) into v_result from visible;
  return v_result;
end $$;

create or replace function public.social_send_friend_request(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_row public.friendships;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_user_id is null or p_user_id=v_actor then raise exception 'invalid friend'; end if;
  if not exists(select 1 from public.profiles where user_id=p_user_id) then raise exception 'profile not found' using errcode='P0002'; end if;
  if private.social_blocked(v_actor,p_user_id) then raise exception 'user unavailable' using errcode='42501'; end if;
  select * into v_row from public.friendships f where (f.requester_id=v_actor and f.addressee_id=p_user_id) or (f.requester_id=p_user_id and f.addressee_id=v_actor) for update;
  if v_row.id is null then insert into public.friendships(requester_id,addressee_id) values(v_actor,p_user_id) returning * into v_row; end if;
  return to_jsonb(v_row);
end $$;

create or replace function public.social_accept_friend_request(p_friendship_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_row public.friendships;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  select * into v_row from public.friendships where id=p_friendship_id for update;
  if v_row.id is null or v_row.addressee_id<>v_actor or v_row.status<>'pending' then raise exception 'request unavailable' using errcode='42501'; end if;
  if private.social_blocked(v_row.requester_id,v_row.addressee_id) then raise exception 'user unavailable' using errcode='42501'; end if;
  update public.friendships set status='accepted',accepted_at=now(),updated_at=now() where id=v_row.id returning * into v_row;
  return to_jsonb(v_row);
end $$;

create or replace function public.social_decline_friend_request(p_friendship_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  delete from public.friendships where id=p_friendship_id and addressee_id=v_actor and status='pending';
end $$;

create or replace function public.social_remove_friend(p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  delete from public.friendships f where f.status='accepted' and ((f.requester_id=v_actor and f.addressee_id=p_user_id) or (f.requester_id=p_user_id and f.addressee_id=v_actor));
end $$;

create or replace function public.social_block_user(p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_user_id is null or p_user_id=v_actor then raise exception 'invalid user'; end if;
  insert into public.user_blocks(blocker_id,blocked_id) values(v_actor,p_user_id) on conflict do nothing;
  delete from public.friendships f where (f.requester_id=v_actor and f.addressee_id=p_user_id) or (f.requester_id=p_user_id and f.addressee_id=v_actor);
  if to_regclass('public.ashyk_invites') is not null then
    update public.ashyk_rooms r set status='abandoned',revision=revision+1,updated_at=now()
    from public.ashyk_invites i where i.room_id=r.id and i.status='pending' and ((i.host_user_id=v_actor and i.friend_user_id=p_user_id) or (i.host_user_id=p_user_id and i.friend_user_id=v_actor));
    update public.ashyk_invites i set status='cancelled',updated_at=now() where i.status='pending' and ((i.host_user_id=v_actor and i.friend_user_id=p_user_id) or (i.host_user_id=p_user_id and i.friend_user_id=v_actor));
  end if;
end $$;

create or replace function public.social_unblock_user(p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  delete from public.user_blocks where blocker_id=v_actor and blocked_id=p_user_id;
end $$;

revoke all on function public.social_search_users(text,integer) from public,anon;
revoke all on function public.social_leaderboard(integer,integer) from public,anon;
revoke all on function public.social_send_friend_request(uuid) from public,anon;
revoke all on function public.social_accept_friend_request(uuid) from public,anon;
revoke all on function public.social_decline_friend_request(uuid) from public,anon;
revoke all on function public.social_remove_friend(uuid) from public,anon;
revoke all on function public.social_block_user(uuid) from public,anon;
revoke all on function public.social_unblock_user(uuid) from public,anon;
grant execute on function public.social_search_users(text,integer) to authenticated;
grant execute on function public.social_leaderboard(integer,integer) to authenticated;
grant execute on function public.social_send_friend_request(uuid) to authenticated;
grant execute on function public.social_accept_friend_request(uuid) to authenticated;
grant execute on function public.social_decline_friend_request(uuid) to authenticated;
grant execute on function public.social_remove_friend(uuid) to authenticated;
grant execute on function public.social_block_user(uuid) to authenticated;
grant execute on function public.social_unblock_user(uuid) to authenticated;

commit;

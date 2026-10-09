-- Full admin user list with order and ranks matching the public social leaderboard.
create or replace function public.admin_user_ranked_list()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v_rows jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p
    where p.user_id=auth.uid() and p.activity_access is true
  ) then
    raise exception 'activity access denied' using errcode='42501';
  end if;
  with ranked as (
    select p.user_id,
      coalesce(s.rating_score,0)::numeric(12,2) as rating_score,
      dense_rank() over(order by coalesce(s.rating_score,0) desc)::int as rank
    from public.profiles p
    left join public.user_social_stats s on s.user_id=p.user_id
  ), activity as (
    select obj from jsonb_array_elements(public.admin_user_activity_list()) as e(obj)
  )
  select coalesce(jsonb_agg(
    a.obj || jsonb_build_object('rank',r.rank,'rating_score',r.rating_score)
    order by r.rank, a.obj->>'nickname',a.obj->>'user_id'
  ),'[]'::jsonb)
  into v_rows
  from activity a
  join ranked r on r.user_id::text=a.obj->>'user_id';
  return v_rows;
end
$$;
revoke all on function public.admin_user_ranked_list() from public, anon;
grant execute on function public.admin_user_ranked_list() to authenticated;

begin;

alter table public.profiles
  alter column nickname drop not null;

create or replace function private.ensure_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(user_id, nickname, avatar_gender)
  values (new.id, null, null)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists auth_user_profile_shell on auth.users;
create trigger auth_user_profile_shell
after insert on auth.users
for each row execute function private.ensure_auth_user_profile();

insert into public.profiles(user_id, nickname, avatar_gender)
select u.id, null, null
from auth.users u
left join public.profiles p on p.user_id = u.id
where p.user_id is null
on conflict (user_id) do nothing;

create or replace function private.guard_profile_identity_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.avatar_gender is not null
     and new.avatar_gender is distinct from old.avatar_gender then
    raise exception 'avatar gender already selected' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_identity_update_guard on public.profiles;
create trigger profiles_identity_update_guard
before update on public.profiles
for each row execute function private.guard_profile_identity_update();

create or replace function public.is_nickname_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select candidate is not null
    and char_length(btrim(candidate)) between 3 and 30
    and btrim(candidate) ~ '^[[:alnum:]_]+$'
    and not exists (
      select 1
      from public.profiles p
      where p.nickname is not null
        and lower(p.nickname) = lower(btrim(candidate))
        and (auth.uid() is null or p.user_id <> auth.uid())
    );
$$;

revoke all on function public.is_nickname_available(text) from public, anon;
grant execute on function public.is_nickname_available(text) to authenticated;

with word_weights as (
  select w.word_id, max(private.social_dictionary_weight(w.dictionary_id)) as dictionary_weight
  from public.v_words_app w
  group by w.word_id
), scores as (
  select
    u.id as user_id,
    coalesce(sum(
      case
        when wp.mastery_status in ('mastered','review')
          then coalesce(ww.dictionary_weight,0) * private.social_mastery_weight(wp.mastery_percent)
        else 0
      end
    ),0)::numeric(12,2) as rating_score
  from auth.users u
  left join public.user_word_progress wp on wp.user_id = u.id
  left join word_weights ww on ww.word_id = wp.word_id
  group by u.id
)
insert into public.user_social_stats(user_id,rating_score,updated_at)
select user_id,rating_score,now()
from scores
on conflict(user_id) do update
set rating_score=excluded.rating_score,updated_at=excluded.updated_at;

create or replace function public.social_leaderboard(p_limit integer default 100,p_offset integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_actor uuid:=auth.uid();v_result jsonb;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  with ranked as (
    select
      u.id as user_id,
      p.nickname,
      p.avatar_gender,
      coalesce(s.rating_score,0)::numeric(12,2) rating_score,
      dense_rank() over(order by coalesce(s.rating_score,0) desc)::int rank
    from auth.users u
    left join public.profiles p on p.user_id=u.id
    left join public.user_social_stats s on s.user_id=u.id
  ),visible as (
    select r.*,private.social_relation(v_actor,r.user_id) relation,
      (select f.id from public.friendships f where (f.requester_id=v_actor and f.addressee_id=r.user_id) or (f.requester_id=r.user_id and f.addressee_id=v_actor) limit 1) friendship_id
    from ranked r
    where r.user_id=v_actor or not private.social_blocked(v_actor,r.user_id)
    order by r.rank,r.nickname nulls last,r.user_id
    limit least(200,greatest(1,coalesce(p_limit,100))) offset greatest(0,coalesce(p_offset,0))
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'rank',rank,'user_id',user_id,'nickname',nickname,'avatar_gender',avatar_gender,
    'rating_score',rating_score,'relation',relation,'friendship_id',friendship_id
  ) order by rank,nickname nulls last,user_id),'[]'::jsonb)
  into v_result from visible;
  return v_result;
end;
$$;

create or replace function public.social_search_users(p_query text default '',p_limit integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_actor uuid:=auth.uid();v_result jsonb;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id',x.user_id,'nickname',x.nickname,'avatar_gender',x.avatar_gender,
    'rating_score',x.rating_score,'relation',x.relation,'friendship_id',x.friendship_id
  ) order by x.rating_score desc,x.nickname,x.user_id),'[]'::jsonb)
  into v_result
  from (
    select
      u.id as user_id,
      p.nickname,
      p.avatar_gender,
      coalesce(s.rating_score,0) rating_score,
      private.social_relation(v_actor,u.id) relation,
      (select f.id from public.friendships f where (f.requester_id=v_actor and f.addressee_id=u.id) or (f.requester_id=u.id and f.addressee_id=v_actor) limit 1) friendship_id
    from auth.users u
    left join public.profiles p on p.user_id=u.id
    left join public.user_social_stats s on s.user_id=u.id
    where u.id<>v_actor
      and p.nickname is not null
      and not private.social_blocked(v_actor,u.id)
      and (btrim(coalesce(p_query,''))='' or p.nickname ilike '%'||btrim(p_query)||'%')
    order by coalesce(s.rating_score,0) desc,p.nickname,u.id
    limit least(100,greatest(1,coalesce(p_limit,30)))
  ) x;
  return v_result;
end;
$$;

revoke all on function public.social_leaderboard(integer,integer) from public,anon;
revoke all on function public.social_search_users(text,integer) from public,anon;
grant execute on function public.social_leaderboard(integer,integer) to authenticated;
grant execute on function public.social_search_users(text,integer) to authenticated;

commit;

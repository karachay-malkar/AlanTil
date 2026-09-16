begin;

alter table public.user_word_progress add column if not exists mastery_percent numeric(5,2) not null default 0;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='user_word_progress_mastery_percent_check' and conrelid='public.user_word_progress'::regclass) then
    alter table public.user_word_progress add constraint user_word_progress_mastery_percent_check check (mastery_percent between 0 and 100) not valid;
  end if;
end $$;

with historical as (
  select sw.user_id,sw.word_id,max(s.accuracy)::numeric(5,2) best_accuracy
  from public.station_test_session_words sw
  join public.station_test_sessions s on s.id=sw.session_id and s.user_id=sw.user_id
  where sw.result='correct' and s.status='completed' and coalesce(s.accuracy,0)>=80
  group by sw.user_id,sw.word_id
)
update public.user_word_progress wp set mastery_percent=greatest(wp.mastery_percent,coalesce(h.best_accuracy,0),case when wp.mastery_status in ('mastered','review') then 80 else 0 end)
from historical h where h.user_id=wp.user_id and h.word_id=wp.word_id;
update public.user_word_progress set mastery_percent=greatest(mastery_percent,80) where mastery_status in ('mastered','review') and mastery_percent<80;
alter table public.user_word_progress validate constraint user_word_progress_mastery_percent_check;

create or replace function private.apply_mastery_percent() returns trigger language plpgsql security definer set search_path='' as $$
declare v_best numeric:=0;
begin
  select coalesce(max(s.accuracy),0) into v_best
  from public.station_test_session_words sw join public.station_test_sessions s on s.id=sw.session_id and s.user_id=sw.user_id
  where sw.user_id=new.user_id and sw.word_id=new.word_id and sw.result='correct' and s.status='completed' and coalesce(s.accuracy,0)>=80;
  new.mastery_percent:=least(100,greatest(coalesce(new.mastery_percent,0),v_best,case when new.mastery_status in ('mastered','review') then 80 else 0 end));
  return new;
end $$;
drop trigger if exists user_word_progress_mastery_percent_guard on public.user_word_progress;
create trigger user_word_progress_mastery_percent_guard before insert or update of mastery_status,mastery_percent on public.user_word_progress for each row execute function private.apply_mastery_percent();

create table if not exists public.user_social_stats(
  user_id uuid primary key references auth.users(id) on delete cascade,
  rating_score numeric(12,2) not null default 0 check(rating_score>=0),
  updated_at timestamptz not null default now()
);
alter table public.user_social_stats enable row level security;
revoke all on public.user_social_stats from public,anon,authenticated;
create index if not exists user_social_stats_rating_idx on public.user_social_stats(rating_score desc,user_id);

create or replace function private.social_dictionary_weight(p_dictionary_id text) returns numeric language sql immutable set search_path='' as $$
select case lower(coalesce(p_dictionary_id,'')) when 'beginner' then 1::numeric when 'intermediate' then 2::numeric when 'advanced' then 3::numeric else 1.5::numeric end $$;
create or replace function private.social_mastery_weight(p_percent numeric) returns numeric language sql immutable set search_path='' as $$
select case when coalesce(p_percent,0)>=100 then 2::numeric when coalesce(p_percent,0)>=90 then 1.5::numeric when coalesce(p_percent,0)>=80 then 1::numeric else 0::numeric end $$;
create or replace function private.social_word_dictionary_weight(p_word_id text) returns numeric language sql stable security definer set search_path='' as $$
select coalesce(max(private.social_dictionary_weight(w.dictionary_id)),0) from public.v_words_app w where w.word_id=p_word_id $$;
create or replace function private.social_word_points(p_word_id text,p_status text,p_percent numeric) returns numeric language sql stable security definer set search_path='' as $$
select case when p_status in ('mastered','review') then private.social_word_dictionary_weight(p_word_id)*private.social_mastery_weight(p_percent) else 0::numeric end $$;

with word_weights as (
  select w.word_id,max(private.social_dictionary_weight(w.dictionary_id)) dictionary_weight from public.v_words_app w group by w.word_id
), scores as (
  select p.user_id,coalesce(sum(case when wp.mastery_status in ('mastered','review') then ww.dictionary_weight*private.social_mastery_weight(wp.mastery_percent) else 0 end),0)::numeric(12,2) rating_score
  from public.profiles p left join public.user_word_progress wp on wp.user_id=p.user_id left join word_weights ww on ww.word_id=wp.word_id group by p.user_id
)
insert into public.user_social_stats(user_id,rating_score,updated_at) select user_id,rating_score,now() from scores
on conflict(user_id) do update set rating_score=excluded.rating_score,updated_at=excluded.updated_at;

create or replace function private.update_social_rating_delta() returns trigger language plpgsql security definer set search_path='' as $$
declare v_old numeric:=0;v_new numeric:=0;v_uid uuid;
begin
  v_uid:=coalesce(new.user_id,old.user_id);
  if tg_op<>'INSERT' then v_old:=private.social_word_points(old.word_id,old.mastery_status,old.mastery_percent); end if;
  if tg_op<>'DELETE' then v_new:=private.social_word_points(new.word_id,new.mastery_status,new.mastery_percent); end if;
  insert into public.user_social_stats(user_id,rating_score,updated_at) values(v_uid,greatest(0,v_new-v_old),now())
  on conflict(user_id) do update set rating_score=greatest(0,public.user_social_stats.rating_score+(v_new-v_old)),updated_at=now();
  return coalesce(new,old);
end $$;
drop trigger if exists user_word_progress_social_rating on public.user_word_progress;
create trigger user_word_progress_social_rating after insert or update of mastery_status,mastery_percent or delete on public.user_word_progress for each row execute function private.update_social_rating_delta();

create table if not exists public.friendships(
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','accepted')),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),accepted_at timestamptz,
  check(requester_id<>addressee_id)
);
create unique index if not exists friendships_pair_unique on public.friendships(least(requester_id,addressee_id),greatest(requester_id,addressee_id));
create index if not exists friendships_addressee_status_idx on public.friendships(addressee_id,status,created_at desc);
create index if not exists friendships_requester_status_idx on public.friendships(requester_id,status,created_at desc);
alter table public.friendships enable row level security;
revoke all on public.friendships from public,anon,authenticated;
grant select on public.friendships to authenticated;
drop policy if exists friendships_members_read on public.friendships;
create policy friendships_members_read on public.friendships for select to authenticated using(auth.uid()=requester_id or auth.uid()=addressee_id);

create table if not exists public.user_blocks(
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),primary key(blocker_id,blocked_id),check(blocker_id<>blocked_id)
);
alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from public,anon,authenticated;
grant select on public.user_blocks to authenticated;
drop policy if exists user_blocks_owner_read on public.user_blocks;
create policy user_blocks_owner_read on public.user_blocks for select to authenticated using(auth.uid()=blocker_id);

create or replace function private.social_blocked(p_left uuid,p_right uuid) returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.user_blocks b where (b.blocker_id=p_left and b.blocked_id=p_right) or (b.blocker_id=p_right and b.blocked_id=p_left)) $$;
create or replace function private.social_are_friends(p_left uuid,p_right uuid) returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.friendships f where f.status='accepted' and ((f.requester_id=p_left and f.addressee_id=p_right) or (f.requester_id=p_right and f.addressee_id=p_left))) $$;
create or replace function private.social_relation(p_actor uuid,p_target uuid) returns text language sql stable security definer set search_path='' as $$
select coalesce((select case when f.status='accepted' then 'accepted' when f.requester_id=p_actor then 'outgoing' else 'incoming' end from public.friendships f where (f.requester_id=p_actor and f.addressee_id=p_target) or (f.requester_id=p_target and f.addressee_id=p_actor) limit 1),'none') $$;

create or replace function private.social_streak(p_user_id uuid) returns integer language sql stable security definer set search_path='' as $$
with days as (select distinct (v.last_seen_at at time zone 'Europe/Moscow')::date day from public.anonymous_visit_sessions v where v.user_id=p_user_id),numbered as (select day,row_number() over(order by day desc)::int rn from days),groups as (select count(*)::int streak,max(day) latest from numbered group by day+rn)
select coalesce((select case when latest>=((now() at time zone 'Europe/Moscow')::date-1) then streak else 0 end from groups order by latest desc limit 1),0) $$;

create or replace function private.social_story_progress(p_user_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
with catalog as (select w.story_id,w.word_id from public.v_words_app w where nullif(w.story_id,'') is not null group by w.story_id,w.word_id),totals as (select story_id,count(*)::numeric total from catalog group by story_id),mastered as (select c.story_id,count(*)::numeric mastered from catalog c join public.user_word_progress wp on wp.user_id=p_user_id and wp.word_id=c.word_id where wp.mastery_status in ('mastered','review') group by c.story_id)
select coalesce(jsonb_object_agg(t.story_id,jsonb_build_object('percent',case when t.total>0 then round(coalesce(m.mastered,0)*100/t.total)::int else 0 end)),'{}'::jsonb) from totals t left join mastered m using(story_id) $$;

commit;

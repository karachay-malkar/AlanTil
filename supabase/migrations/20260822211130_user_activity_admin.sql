-- AlanTil 13.15.9 — protected user activity dashboard and account-linked visit sessions.
-- No separate permissions table: profiles.activity_access is protected by column grants
-- and every administrative RPC verifies auth.uid() server-side.

begin;

alter table public.profiles
  add column if not exists activity_access boolean not null default false;

comment on column public.profiles.activity_access is
  'Allows the account to view protected user activity screens and RPCs.';

update public.profiles
set activity_access = true
where nickname = 'Taulu07';

revoke insert, update on table public.profiles from anon, authenticated;
grant insert (user_id, nickname, avatar_gender) on table public.profiles to authenticated;
grant update (nickname, avatar_gender) on table public.profiles to authenticated;

alter table public.anonymous_visit_sessions
  add column if not exists user_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'anonymous_visit_sessions_user_id_fkey'
      and conrelid = 'public.anonymous_visit_sessions'::regclass
  ) then
    alter table public.anonymous_visit_sessions
      add constraint anonymous_visit_sessions_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete set null;
  end if;
end;
$$;

create index if not exists anonymous_visit_sessions_user_seen_idx
  on public.anonymous_visit_sessions (user_id, last_seen_at desc)
  where user_id is not null;

create or replace function public.record_anonymous_visit(
  p_visitor_id uuid,
  p_session_id uuid,
  p_page_path text,
  p_referrer_host text default null,
  p_app_version text default 'unknown'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_page_path text;
  v_referrer_host text;
  v_app_version text;
  v_user_id uuid := auth.uid();
begin
  if p_visitor_id is null or p_session_id is null then
    raise exception 'visitor_id and session_id are required';
  end if;

  v_page_path := left(coalesce(nullif(btrim(p_page_path), ''), '/'), 300);
  v_page_path := split_part(split_part(v_page_path, '?', 1), '#', 1);
  if left(v_page_path, 1) <> '/' then
    v_page_path := '/';
  end if;

  v_referrer_host := lower(left(nullif(btrim(p_referrer_host), ''), 253));
  if v_referrer_host is not null and v_referrer_host !~ '^[a-z0-9.-]+$' then
    v_referrer_host := null;
  end if;

  v_app_version := left(regexp_replace(coalesce(nullif(btrim(p_app_version), ''), 'unknown'), '[^0-9A-Za-z._-]', '', 'g'), 32);
  if v_app_version = '' then
    v_app_version := 'unknown';
  end if;

  insert into public.anonymous_visit_sessions (
    session_id,
    visitor_id,
    user_id,
    first_seen_at,
    last_seen_at,
    pageviews,
    first_path,
    last_path,
    referrer_host,
    app_version
  ) values (
    p_session_id,
    p_visitor_id,
    v_user_id,
    now(),
    now(),
    1,
    v_page_path,
    v_page_path,
    v_referrer_host,
    v_app_version
  )
  on conflict (session_id) do update
  set
    user_id = coalesce(public.anonymous_visit_sessions.user_id, excluded.user_id),
    last_seen_at = now(),
    pageviews = public.anonymous_visit_sessions.pageviews + 1,
    last_path = excluded.last_path,
    referrer_host = coalesce(public.anonymous_visit_sessions.referrer_host, excluded.referrer_host),
    app_version = excluded.app_version
  where public.anonymous_visit_sessions.visitor_id = excluded.visitor_id
    and (
      public.anonymous_visit_sessions.user_id is null
      or excluded.user_id is null
      or public.anonymous_visit_sessions.user_id = excluded.user_id
    );
end;
$$;

revoke all on function public.record_anonymous_visit(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.record_anonymous_visit(uuid, uuid, text, text, text) to anon, authenticated;

comment on table public.anonymous_visit_sessions is
  'Internal browser visit sessions used for unique-visit counts, recency and streaks. Rows are not readable by browser roles.';
comment on function public.record_anonymous_visit(uuid, uuid, text, text, text) is
  'Records internal visit activity and links an authenticated account server-side when auth.uid() is available.';

create or replace function public.admin_user_activity_list()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if v_actor is null or not exists (
    select 1 from public.profiles p
    where p.user_id = v_actor and p.activity_access is true
  ) then
    raise exception 'activity access denied' using errcode = '42501';
  end if;

  with station_catalog as (
    select distinct w.story_id, w.dictionary_id, w.section_id, w.set_id
    from public.v_words_app w
  ),
  totals as (
    select
      count(*) filter (where story_id = 'oblivion')::int as oblivion_total,
      count(*) filter (where story_id = 'roots')::int as roots_total,
      count(*) filter (where story_id = 'ascent')::int as ascent_total,
      count(*) filter (where story_id = 'pathways')::int as pathways_total
    from station_catalog
  ),
  passed as (
    select
      s.user_id,
      count(distinct (s.dictionary_id, s.group_id, s.set_id)) filter (where s.story_type = 'oblivion')::int as oblivion_passed,
      count(distinct (s.dictionary_id, s.group_id, s.set_id)) filter (where s.story_type = 'roots')::int as roots_passed,
      count(distinct (s.dictionary_id, s.group_id, s.set_id)) filter (where s.story_type = 'ascent')::int as ascent_passed,
      count(distinct (s.dictionary_id, s.group_id, s.set_id)) filter (where s.story_type = 'pathways')::int as pathways_passed
    from public.station_test_sessions s
    where s.status = 'completed'
      and s.phase = 'first_test'
      and coalesce(s.accuracy, 0) >= 80
    group by s.user_id
  ),
  mastered as (
    select wp.user_id, count(*)::int as mastered_words
    from public.user_word_progress wp
    where wp.mastery_status in ('mastered', 'review')
    group by wp.user_id
  ),
  visits as (
    select av.user_id, max(av.last_seen_at) as last_seen_at
    from public.anonymous_visit_sessions av
    where av.user_id is not null
    group by av.user_id
  ),
  visit_days as (
    select av.user_id, (av.last_seen_at at time zone 'Europe/Moscow')::date as visit_day
    from public.anonymous_visit_sessions av
    where av.user_id is not null
    group by av.user_id, (av.last_seen_at at time zone 'Europe/Moscow')::date
  ),
  numbered_days as (
    select vd.user_id, vd.visit_day,
      row_number() over (partition by vd.user_id order by vd.visit_day desc) as rn
    from visit_days vd
  ),
  streak_groups as (
    select nd.user_id,
      count(*)::int as streak_days,
      max(nd.visit_day) as latest_day
    from numbered_days nd
    group by nd.user_id, nd.visit_day + nd.rn::int
  ),
  streaks as (
    select distinct on (sg.user_id)
      sg.user_id,
      case
        when sg.latest_day >= ((now() at time zone 'Europe/Moscow')::date - 1)
          then sg.streak_days
        else 0
      end::int as streak_days
    from streak_groups sg
    order by sg.user_id, sg.latest_day desc
  ),
  rows as (
    select
      p.user_id,
      p.nickname,
      greatest(v.last_seen_at, au.last_sign_in_at) as last_seen_at,
      coalesce(st.streak_days, 0)::int as streak_days,
      coalesce(m.mastered_words, 0)::int as mastered_words,
      coalesce(ps.oblivion_passed, 0)::int as oblivion_passed,
      t.oblivion_total,
      coalesce(ps.roots_passed, 0)::int as roots_passed,
      t.roots_total,
      coalesce(ps.ascent_passed, 0)::int as ascent_passed,
      t.ascent_total,
      coalesce(ps.pathways_passed, 0)::int as pathways_passed,
      t.pathways_total
    from public.profiles p
    join auth.users au on au.id = p.user_id
    cross join totals t
    left join passed ps on ps.user_id = p.user_id
    left join mastered m on m.user_id = p.user_id
    left join visits v on v.user_id = p.user_id
    left join streaks st on st.user_id = p.user_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', r.user_id,
        'nickname', r.nickname,
        'last_seen_at', r.last_seen_at,
        'streak_days', r.streak_days,
        'mastered_words', r.mastered_words,
        'stories', jsonb_build_object(
          'oblivion', jsonb_build_object('passed', r.oblivion_passed, 'total', r.oblivion_total),
          'roots', jsonb_build_object('passed', r.roots_passed, 'total', r.roots_total),
          'ascent', jsonb_build_object('passed', r.ascent_passed, 'total', r.ascent_total),
          'pathways', jsonb_build_object('passed', r.pathways_passed, 'total', r.pathways_total)
        )
      )
      order by r.streak_days desc, r.last_seen_at desc nulls last, lower(r.nickname)
    ),
    '[]'::jsonb
  ) into v_result
  from rows r;

  return v_result;
end;
$$;

create or replace function public.admin_user_activity_detail(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_nickname text;
  v_last_seen timestamptz;
  v_streak int := 0;
  v_mastered int := 0;
  v_favorite_count int := 0;
  v_stories jsonb := '[]'::jsonb;
  v_tests jsonb := '[]'::jsonb;
  v_favorites jsonb := '[]'::jsonb;
  v_problems jsonb := '[]'::jsonb;
begin
  if v_actor is null or not exists (
    select 1 from public.profiles p
    where p.user_id = v_actor and p.activity_access is true
  ) then
    raise exception 'activity access denied' using errcode = '42501';
  end if;

  select p.nickname into v_nickname
  from public.profiles p
  where p.user_id = p_user_id;

  if not found then
    return null;
  end if;

  select greatest(max(av.last_seen_at), max(au.last_sign_in_at))
  into v_last_seen
  from auth.users au
  left join public.anonymous_visit_sessions av on av.user_id = au.id
  where au.id = p_user_id;

  with visit_days as (
    select (av.last_seen_at at time zone 'Europe/Moscow')::date as visit_day
    from public.anonymous_visit_sessions av
    where av.user_id = p_user_id
    group by (av.last_seen_at at time zone 'Europe/Moscow')::date
  ),
  numbered_days as (
    select vd.visit_day, row_number() over (order by vd.visit_day desc) as rn
    from visit_days vd
  ),
  streak_groups as (
    select count(*)::int as streak_days, max(nd.visit_day) as latest_day
    from numbered_days nd
    group by nd.visit_day + nd.rn::int
  )
  select case
      when sg.latest_day >= ((now() at time zone 'Europe/Moscow')::date - 1) then sg.streak_days
      else 0
    end::int
  into v_streak
  from streak_groups sg
  order by sg.latest_day desc
  limit 1;
  v_streak := coalesce(v_streak, 0);

  select count(*)::int into v_mastered
  from public.user_word_progress wp
  where wp.user_id = p_user_id
    and wp.mastery_status in ('mastered', 'review');

  select count(*)::int into v_favorite_count
  from public.user_word_favorites f
  where f.user_id = p_user_id and f.is_active is true;

  with station_catalog as (
    select
      w.story_id,
      w.dictionary_id,
      w.section_id,
      w.set_id,
      min(w.global_order) as first_order,
      row_number() over (
        partition by w.story_id
        order by min(w.global_order), w.set_id
      )::int as station_number
    from public.v_words_app w
    group by w.story_id, w.dictionary_id, w.section_id, w.set_id
  ),
  totals as (
    select sc.story_id, count(*)::int as total
    from station_catalog sc
    group by sc.story_id
  ),
  passed as (
    select s.story_type,
      count(distinct (s.dictionary_id, s.group_id, s.set_id))::int as passed
    from public.station_test_sessions s
    where s.user_id = p_user_id
      and s.status = 'completed'
      and s.phase = 'first_test'
      and coalesce(s.accuracy, 0) >= 80
    group by s.story_type
  ),
  story_order(story_type, ordinal) as (
    values ('oblivion'::text, 1), ('roots'::text, 2), ('ascent'::text, 3), ('pathways'::text, 4)
  )
  select jsonb_agg(
    jsonb_build_object(
      'story_type', so.story_type,
      'story_number', so.ordinal,
      'passed', coalesce(pa.passed, 0),
      'total', coalesce(t.total, 0)
    ) order by so.ordinal
  ) into v_stories
  from story_order so
  left join totals t on t.story_id = so.story_type
  left join passed pa on pa.story_type = so.story_type;

  with station_catalog as (
    select
      w.story_id,
      w.dictionary_id,
      w.section_id,
      w.set_id,
      row_number() over (
        partition by w.story_id
        order by min(w.global_order), w.set_id
      )::int as station_number
    from public.v_words_app w
    group by w.story_id, w.dictionary_id, w.section_id, w.set_id
  ),
  recent_tests as (
    select
      s.id as session_id,
      s.story_type,
      case s.story_type when 'oblivion' then 1 when 'roots' then 2 when 'ascent' then 3 when 'pathways' then 4 else 0 end as story_number,
      coalesce(sc.station_number, 0)::int as station_number,
      s.phase,
      s.status,
      s.started_at,
      s.ended_at,
      s.duration_sec,
      s.active_duration_sec,
      s.questions_total,
      s.correct_total,
      s.wrong_total,
      s.accuracy
    from public.station_test_sessions s
    left join station_catalog sc
      on sc.story_id = s.story_type
     and sc.dictionary_id = s.dictionary_id
     and sc.section_id = s.group_id
     and sc.set_id = s.set_id
    where s.user_id = p_user_id and s.status = 'completed'
    order by coalesce(s.ended_at, s.started_at, s.created_at) desc
    limit 200
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'session_id', rt.session_id,
    'story_type', rt.story_type,
    'story_number', rt.story_number,
    'station_number', rt.station_number,
    'phase', rt.phase,
    'started_at', rt.started_at,
    'ended_at', rt.ended_at,
    'duration_sec', rt.duration_sec,
    'active_duration_sec', rt.active_duration_sec,
    'questions_total', rt.questions_total,
    'correct_total', rt.correct_total,
    'wrong_total', rt.wrong_total,
    'accuracy', rt.accuracy
  ) order by coalesce(rt.ended_at, rt.started_at) desc), '[]'::jsonb)
  into v_tests
  from recent_tests rt;

  select coalesce(jsonb_agg(jsonb_build_object(
    'word_id', f.word_id,
    'word_alan_cyrillic', w.word_alan_cyrillic,
    'word_alan_turkic', w.word_alan_turkic,
    'translation_ru', w.translation_ru,
    'translation_en', w.translation_en,
    'translation_tr', w.translation_tr,
    'updated_at', f.updated_at
  ) order by f.updated_at desc), '[]'::jsonb)
  into v_favorites
  from public.user_word_favorites f
  join public.v_words_app w on w.word_id = f.word_id
  where f.user_id = p_user_id and f.is_active is true;

  with ranked as (
    select
      wp.word_id,
      wp.test_wrong_count,
      wp.unknown_count,
      wp.test_answers_total,
      wp.study_shown_count,
      w.word_alan_cyrillic,
      w.word_alan_turkic,
      w.translation_ru,
      w.translation_en,
      w.translation_tr
    from public.user_word_progress wp
    join public.v_words_app w on w.word_id = wp.word_id
    where wp.user_id = p_user_id
      and (coalesce(wp.test_wrong_count, 0) > 0 or coalesce(wp.unknown_count, 0) > 0)
    order by coalesce(wp.test_wrong_count, 0) desc,
             coalesce(wp.unknown_count, 0) desc,
             coalesce(wp.test_answers_total, 0) desc,
             coalesce(wp.study_shown_count, 0) desc,
             w.global_order
    limit 10
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'word_id', r.word_id,
    'word_alan_cyrillic', r.word_alan_cyrillic,
    'word_alan_turkic', r.word_alan_turkic,
    'translation_ru', r.translation_ru,
    'translation_en', r.translation_en,
    'translation_tr', r.translation_tr,
    'test_wrong_count', r.test_wrong_count,
    'unknown_count', r.unknown_count
  )), '[]'::jsonb)
  into v_problems
  from ranked r;

  return jsonb_build_object(
    'user_id', p_user_id,
    'nickname', v_nickname,
    'last_seen_at', v_last_seen,
    'streak_days', v_streak,
    'mastered_words', v_mastered,
    'favorite_words', v_favorite_count,
    'stories', coalesce(v_stories, '[]'::jsonb),
    'tests', coalesce(v_tests, '[]'::jsonb),
    'favorites', coalesce(v_favorites, '[]'::jsonb),
    'problem_words', coalesce(v_problems, '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_station_test_detail(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if v_actor is null or not exists (
    select 1 from public.profiles p
    where p.user_id = v_actor and p.activity_access is true
  ) then
    raise exception 'activity access denied' using errcode = '42501';
  end if;

  with station_catalog as (
    select
      w.story_id,
      w.dictionary_id,
      w.section_id,
      w.set_id,
      row_number() over (
        partition by w.story_id
        order by min(w.global_order), w.set_id
      )::int as station_number
    from public.v_words_app w
    group by w.story_id, w.dictionary_id, w.section_id, w.set_id
  ),
  session_row as (
    select
      s.*,
      p.nickname,
      case s.story_type when 'oblivion' then 1 when 'roots' then 2 when 'ascent' then 3 when 'pathways' then 4 else 0 end as story_number,
      coalesce(sc.station_number, 0)::int as station_number
    from public.station_test_sessions s
    join public.profiles p on p.user_id = s.user_id
    left join station_catalog sc
      on sc.story_id = s.story_type
     and sc.dictionary_id = s.dictionary_id
     and sc.section_id = s.group_id
     and sc.set_id = s.set_id
    where s.id = p_session_id
  ),
  word_rows as (
    select
      sw.word_id,
      sw.result,
      sw.wrong_word_id,
      w.global_order,
      w.word_alan_cyrillic,
      w.word_alan_turkic,
      w.translation_ru,
      w.translation_en,
      w.translation_tr,
      wrong.word_alan_cyrillic as wrong_word_alan_cyrillic,
      wrong.word_alan_turkic as wrong_word_alan_turkic,
      wrong.translation_ru as wrong_translation_ru,
      wrong.translation_en as wrong_translation_en,
      wrong.translation_tr as wrong_translation_tr
    from public.station_test_session_words sw
    join session_row sr on sr.id = sw.session_id and sr.user_id = sw.user_id
    join public.v_words_app w on w.word_id = sw.word_id
    left join public.v_words_app wrong on wrong.word_id = sw.wrong_word_id
  ),
  words_json as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'word_id', wr.word_id,
      'result', wr.result,
      'wrong_word_id', wr.wrong_word_id,
      'word_alan_cyrillic', wr.word_alan_cyrillic,
      'word_alan_turkic', wr.word_alan_turkic,
      'translation_ru', wr.translation_ru,
      'translation_en', wr.translation_en,
      'translation_tr', wr.translation_tr,
      'wrong_word_alan_cyrillic', wr.wrong_word_alan_cyrillic,
      'wrong_word_alan_turkic', wr.wrong_word_alan_turkic,
      'wrong_translation_ru', wr.wrong_translation_ru,
      'wrong_translation_en', wr.wrong_translation_en,
      'wrong_translation_tr', wr.wrong_translation_tr
    ) order by wr.global_order), '[]'::jsonb) as words
    from word_rows wr
  )
  select jsonb_build_object(
    'session_id', sr.id,
    'user_id', sr.user_id,
    'nickname', sr.nickname,
    'story_type', sr.story_type,
    'story_number', sr.story_number,
    'station_number', sr.station_number,
    'phase', sr.phase,
    'status', sr.status,
    'started_at', sr.started_at,
    'ended_at', sr.ended_at,
    'duration_sec', sr.duration_sec,
    'active_duration_sec', sr.active_duration_sec,
    'questions_total', sr.questions_total,
    'correct_total', sr.correct_total,
    'wrong_total', sr.wrong_total,
    'accuracy', sr.accuracy,
    'words', wj.words
  ) into v_result
  from session_row sr
  cross join words_json wj;

  return v_result;
end;
$$;

revoke all on function public.admin_user_activity_list() from public, anon, authenticated;
revoke all on function public.admin_user_activity_detail(uuid) from public, anon, authenticated;
revoke all on function public.admin_station_test_detail(uuid) from public, anon, authenticated;
grant execute on function public.admin_user_activity_list() to authenticated;
grant execute on function public.admin_user_activity_detail(uuid) to authenticated;
grant execute on function public.admin_station_test_detail(uuid) to authenticated;

comment on function public.admin_user_activity_list() is
  'Protected aggregate user activity list. Requires profiles.activity_access for auth.uid().';
comment on function public.admin_user_activity_detail(uuid) is
  'Protected per-user learning activity detail. Requires profiles.activity_access for auth.uid().';
comment on function public.admin_station_test_detail(uuid) is
  'Protected station test detail. Requires profiles.activity_access for auth.uid().';

commit;

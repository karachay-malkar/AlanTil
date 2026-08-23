-- AlanTil 13.15.10 — ranked user list and lightweight activity previews.

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
  ),
  ranked_rows as (
    select r.*,
      (row_number() over (
        order by r.streak_days desc, r.mastered_words desc, r.user_id
      ))::int as rank
    from rows r
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'rank', r.rank,
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
      order by r.rank
    ),
    '[]'::jsonb
  ) into v_result
  from ranked_rows r;

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
  v_test_count int := 0;
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

  select count(*)::int into v_test_count
  from public.station_test_sessions s
  where s.user_id = p_user_id and s.status = 'completed';

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
    limit 10
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

  with recent_favorites as (
    select
      f.word_id,
      f.updated_at,
      w.word_alan_cyrillic,
      w.word_alan_turkic,
      w.translation_ru,
      w.translation_en,
      w.translation_tr
    from public.user_word_favorites f
    join public.v_words_app w on w.word_id = f.word_id
    where f.user_id = p_user_id and f.is_active is true
    order by f.updated_at desc
    limit 10
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'word_id', rf.word_id,
    'word_alan_cyrillic', rf.word_alan_cyrillic,
    'word_alan_turkic', rf.word_alan_turkic,
    'translation_ru', rf.translation_ru,
    'translation_en', rf.translation_en,
    'translation_tr', rf.translation_tr,
    'updated_at', rf.updated_at
  ) order by rf.updated_at desc), '[]'::jsonb)
  into v_favorites
  from recent_favorites rf;

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
    'test_sessions', v_test_count,
    'stories', coalesce(v_stories, '[]'::jsonb),
    'tests', coalesce(v_tests, '[]'::jsonb),
    'favorites', coalesce(v_favorites, '[]'::jsonb),
    'problem_words', coalesce(v_problems, '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_user_test_history(p_user_id uuid)
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
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'session_id', s.id,
    'story_type', s.story_type,
    'story_number', case s.story_type when 'oblivion' then 1 when 'roots' then 2 when 'ascent' then 3 when 'pathways' then 4 else 0 end,
    'station_number', coalesce(sc.station_number, 0)::int,
    'started_at', s.started_at,
    'ended_at', s.ended_at,
    'accuracy', s.accuracy
  ) order by coalesce(s.ended_at, s.started_at, s.created_at) desc), '[]'::jsonb)
  into v_result
  from public.station_test_sessions s
  left join station_catalog sc
    on sc.story_id = s.story_type
   and sc.dictionary_id = s.dictionary_id
   and sc.section_id = s.group_id
   and sc.set_id = s.set_id
  where s.user_id = p_user_id and s.status = 'completed';

  return v_result;
end;
$$;

create or replace function public.admin_user_favorites(p_user_id uuid)
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

  select coalesce(jsonb_agg(jsonb_build_object(
    'word_id', f.word_id,
    'word_alan_cyrillic', w.word_alan_cyrillic,
    'word_alan_turkic', w.word_alan_turkic,
    'updated_at', f.updated_at
  ) order by f.updated_at desc), '[]'::jsonb)
  into v_result
  from public.user_word_favorites f
  join public.v_words_app w on w.word_id = f.word_id
  where f.user_id = p_user_id and f.is_active is true;

  return v_result;
end;
$$;

revoke all on function public.admin_user_activity_list() from public, anon, authenticated;
revoke all on function public.admin_user_activity_detail(uuid) from public, anon, authenticated;
revoke all on function public.admin_user_test_history(uuid) from public, anon, authenticated;
revoke all on function public.admin_user_favorites(uuid) from public, anon, authenticated;
grant execute on function public.admin_user_activity_list() to authenticated;
grant execute on function public.admin_user_activity_detail(uuid) to authenticated;
grant execute on function public.admin_user_test_history(uuid) to authenticated;
grant execute on function public.admin_user_favorites(uuid) to authenticated;

comment on function public.admin_user_activity_list() is
  'Protected ranked activity list. Rank uses streak, mastered words, then stable user id.';
comment on function public.admin_user_activity_detail(uuid) is
  'Protected user activity detail with ten-item test and favorite previews.';
comment on function public.admin_user_test_history(uuid) is
  'Protected full completed station-test history for one user.';
comment on function public.admin_user_favorites(uuid) is
  'Protected full active favorite-word list for one user.';

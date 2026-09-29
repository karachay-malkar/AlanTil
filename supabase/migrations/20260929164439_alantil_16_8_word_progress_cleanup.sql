begin;

CREATE OR REPLACE FUNCTION private.merge_word_progress_snapshot(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  owner_id uuid := auth.uid();
  snapshot_id_value text;
  inserted_rows integer := 0;
  merged_rows integer := 0;
  word_row jsonb;
  word_id_value text;
  status_value text;
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;
  if jsonb_typeof(coalesce(payload, '{}'::jsonb)) <> 'object' then
    raise exception 'Snapshot payload must be an object';
  end if;
  if jsonb_typeof(payload->'words') <> 'array' then
    raise exception 'Snapshot words must be an array';
  end if;

  snapshot_id_value := btrim(coalesce(payload->>'snapshot_id', ''));
  if snapshot_id_value = '' then
    raise exception 'Snapshot id is required';
  end if;

  insert into private.word_progress_snapshot_receipts (user_id, snapshot_id)
  values (owner_id, snapshot_id_value)
  on conflict (user_id, snapshot_id) do nothing;
  get diagnostics inserted_rows = row_count;

  if inserted_rows = 0 then
    return jsonb_build_object('created', false, 'snapshot_id', snapshot_id_value, 'merged_rows', 0);
  end if;

  for word_row in select value from jsonb_array_elements(payload->'words')
  loop
    word_id_value := btrim(coalesce(word_row->>'word_id', ''));
    if word_id_value = '' then
      continue;
    end if;
    if not exists (select 1 from public.content_words where word_id = word_id_value) then
      continue;
    end if;
    status_value := case
      when word_row->>'mastery_status' in ('not_started', 'learning', 'mastered', 'review')
        then word_row->>'mastery_status'
      else 'not_started'
    end;

    insert into public.user_word_progress (
      user_id, word_id, learn_sessions_total,
      learn_unfinished_total, test_answers_total, match_sessions_total,
      match_success_total, match_errors_total, study_shown_count,
      known_count, unknown_count, test_correct_count, test_wrong_count,
      mastery_percent, mastery_status, mastered_at, last_mode, last_result,
      last_seen_at, last_studied_at, last_tested_at, updated_at
    ) values (
      owner_id,
      word_id_value,
      greatest(0, coalesce(nullif(word_row->>'learn_sessions_total', '')::integer, 0)),
      greatest(0, coalesce(nullif(word_row->>'learn_unfinished_total', '')::integer, 0)),
      greatest(0, coalesce(nullif(word_row->>'test_answers_total', '')::integer, 0)),
      greatest(0, coalesce(nullif(word_row->>'match_sessions_total', '')::integer, 0)),
      greatest(0, coalesce(nullif(word_row->>'match_success_total', '')::integer, 0)),
      greatest(0, coalesce(nullif(word_row->>'match_errors_total', '')::integer, 0)),
      greatest(0, coalesce(nullif(word_row->>'study_shown_count', '')::bigint, 0)),
      greatest(0, coalesce(nullif(word_row->>'known_count', '')::bigint, 0)),
      greatest(0, coalesce(nullif(word_row->>'unknown_count', '')::bigint, 0)),
      greatest(0, coalesce(nullif(word_row->>'test_correct_count', '')::bigint, 0)),
      greatest(0, coalesce(nullif(word_row->>'test_wrong_count', '')::bigint, 0)),
      least(100, greatest(0, coalesce(nullif(word_row->>'mastery_percent', '')::numeric, 0))),
      status_value,
      nullif(word_row->>'mastered_at', '')::timestamptz,
      case when word_row->>'last_mode' in ('learn', 'test', 'match') then word_row->>'last_mode' else null end,
      nullif(word_row->>'last_result', ''),
      nullif(word_row->>'last_seen_at', '')::timestamptz,
      nullif(word_row->>'last_studied_at', '')::timestamptz,
      nullif(word_row->>'last_tested_at', '')::timestamptz,
      now()
    )
    on conflict (user_id, word_id) do update set
      learn_sessions_total = greatest(public.user_word_progress.learn_sessions_total, excluded.learn_sessions_total),
      learn_unfinished_total = greatest(public.user_word_progress.learn_unfinished_total, excluded.learn_unfinished_total),
      test_answers_total = greatest(public.user_word_progress.test_answers_total, excluded.test_answers_total),
      match_sessions_total = greatest(public.user_word_progress.match_sessions_total, excluded.match_sessions_total),
      match_success_total = greatest(public.user_word_progress.match_success_total, excluded.match_success_total),
      match_errors_total = greatest(public.user_word_progress.match_errors_total, excluded.match_errors_total),
      study_shown_count = greatest(public.user_word_progress.study_shown_count, excluded.study_shown_count),
      known_count = greatest(public.user_word_progress.known_count, excluded.known_count),
      unknown_count = greatest(public.user_word_progress.unknown_count, excluded.unknown_count),
      test_correct_count = greatest(public.user_word_progress.test_correct_count, excluded.test_correct_count),
      test_wrong_count = greatest(public.user_word_progress.test_wrong_count, excluded.test_wrong_count),
      mastery_percent = greatest(public.user_word_progress.mastery_percent, excluded.mastery_percent),
      mastery_status = case
        when public.user_word_progress.mastery_status = 'review' or excluded.mastery_status = 'review' then 'review'
        when public.user_word_progress.mastery_status = 'mastered' or excluded.mastery_status = 'mastered' then 'mastered'
        when public.user_word_progress.mastery_status = 'learning' or excluded.mastery_status = 'learning' then 'learning'
        else 'not_started'
      end,
      mastered_at = case
        when public.user_word_progress.mastered_at is null then excluded.mastered_at
        when excluded.mastered_at is null then public.user_word_progress.mastered_at
        else least(public.user_word_progress.mastered_at, excluded.mastered_at)
      end,
      last_mode = case
        when coalesce(excluded.last_seen_at, '-infinity'::timestamptz)
          > coalesce(public.user_word_progress.last_seen_at, '-infinity'::timestamptz)
          then excluded.last_mode
        else public.user_word_progress.last_mode
      end,
      last_result = case
        when coalesce(excluded.last_seen_at, '-infinity'::timestamptz)
          > coalesce(public.user_word_progress.last_seen_at, '-infinity'::timestamptz)
          then excluded.last_result
        else public.user_word_progress.last_result
      end,
      last_seen_at = greatest(public.user_word_progress.last_seen_at, excluded.last_seen_at),
      last_studied_at = greatest(public.user_word_progress.last_studied_at, excluded.last_studied_at),
      last_tested_at = greatest(public.user_word_progress.last_tested_at, excluded.last_tested_at),
      updated_at = now();
    merged_rows := merged_rows + 1;
  end loop;

  return jsonb_build_object(
    'created', true,
    'snapshot_id', snapshot_id_value,
    'merged_rows', merged_rows
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.protect_word_progress_revision()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'UPDATE' then
    if coalesce(new.last_tested_at, '-infinity'::timestamptz) < coalesce(old.last_tested_at, '-infinity'::timestamptz) then
      new.mastery_status := old.mastery_status;
    end if;
    if old.mastery_status in ('mastered', 'review') and new.mastery_status in ('not_started', 'learning') then
      new.mastery_status := old.mastery_status;
    end if;
    if coalesce(new.last_seen_at, '-infinity'::timestamptz) < coalesce(old.last_seen_at, '-infinity'::timestamptz) then
      new.last_mode := old.last_mode;
      new.last_result := old.last_result;
    end if;
    new.learn_sessions_total := greatest(old.learn_sessions_total, new.learn_sessions_total);
    new.learn_unfinished_total := greatest(old.learn_unfinished_total, new.learn_unfinished_total);
    new.test_answers_total := greatest(old.test_answers_total, new.test_answers_total);
    new.match_sessions_total := greatest(old.match_sessions_total, new.match_sessions_total);
    new.match_success_total := greatest(old.match_success_total, new.match_success_total);
    new.match_errors_total := greatest(old.match_errors_total, new.match_errors_total);
    new.study_shown_count := greatest(old.study_shown_count, new.study_shown_count);
    new.known_count := greatest(old.known_count, new.known_count);
    new.unknown_count := greatest(old.unknown_count, new.unknown_count);
    new.test_correct_count := greatest(old.test_correct_count, new.test_correct_count);
    new.test_wrong_count := greatest(old.test_wrong_count, new.test_wrong_count);
    new.last_seen_at := greatest(old.last_seen_at, new.last_seen_at);
    new.last_studied_at := greatest(old.last_studied_at, new.last_studied_at);
    new.last_tested_at := greatest(old.last_tested_at, new.last_tested_at);
    new.mastered_at := least(old.mastered_at, new.mastered_at);
    new.updated_at := greatest(old.updated_at, new.updated_at);
  end if;

  new.sessions_total :=
    greatest(0, coalesce(new.learn_sessions_total, 0))
    + greatest(0, coalesce(new.test_answers_total, 0))
    + greatest(0, coalesce(new.match_sessions_total, 0));

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.save_learn_session(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  owner_id uuid := auth.uid();
  session_uuid uuid;
  session_status text;
  session_started timestamptz;
  session_ended timestamptz;
  inserted_rows integer := 0;
  word_row jsonb;
  word_id_value text;
  word_result text;
  show_count_value integer;
  left_swipe_count_value integer;
  word_index integer := 0;
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;
  if jsonb_typeof(coalesce(payload, '{}'::jsonb)) <> 'object' then
    raise exception 'Session payload must be an object';
  end if;

  session_uuid := nullif(payload->>'id', '')::uuid;
  if session_uuid is null then
    raise exception 'Session id is required';
  end if;
  session_status := case when payload->>'status' = 'completed' then 'completed' else 'interrupted' end;
  session_started := coalesce(nullif(payload->>'started_at', '')::timestamptz, now());
  session_ended := coalesce(nullif(payload->>'ended_at', '')::timestamptz, now());

  insert into public.learn_sessions (
    id, user_id, dictionary_id, section_id, set_id, direction,
    translation_language_code, started_at, ended_at, duration_sec,
    active_duration_sec, status, exit_reason, words_planned,
    unique_words_shown, card_shows_total, left_swipes_total,
    known_words_total, unfinished_words_total
  ) values (
    session_uuid,
    owner_id,
    coalesce(payload->>'dictionary_id', ''),
    coalesce(payload->>'section_id', ''),
    coalesce(payload->>'set_id', ''),
    case when payload->>'direction' = 'ru_alan' then 'ru_alan' else 'alan_ru' end,
    coalesce(nullif(payload->>'translation_language_code', ''), 'ru'),
    session_started,
    session_ended,
    greatest(0, coalesce(nullif(payload->>'duration_sec', '')::integer, 0)),
    greatest(0, coalesce(nullif(payload->>'active_duration_sec', '')::integer, 0)),
    session_status,
    case when session_status = 'completed' then null else nullif(payload->>'exit_reason', '') end,
    greatest(0, coalesce(nullif(payload->>'words_planned', '')::integer, 0)),
    greatest(0, coalesce(nullif(payload->>'unique_words_shown', '')::integer, 0)),
    greatest(0, coalesce(nullif(payload->>'card_shows_total', '')::integer, 0)),
    greatest(0, coalesce(nullif(payload->>'left_swipes_total', '')::integer, 0)),
    greatest(0, coalesce(nullif(payload->>'known_words_total', '')::integer, 0)),
    greatest(0, coalesce(nullif(payload->>'unfinished_words_total', '')::integer, 0))
  )
  on conflict (id) do nothing;

  get diagnostics inserted_rows = row_count;
  if inserted_rows = 0 then
    return jsonb_build_object('created', false, 'id', session_uuid);
  end if;

  for word_row in
    select value from jsonb_array_elements(
      case when jsonb_typeof(payload->'words') = 'array' then payload->'words' else '[]'::jsonb end
    )
  loop
    word_index := word_index + 1;
    word_id_value := btrim(coalesce(word_row->>'word_id', ''));
    if word_id_value = '' then
      continue;
    end if;
    if not exists (select 1 from public.content_words where word_id = word_id_value) then
      continue;
    end if;
    word_result := case when word_row->>'final_result' = 'known' then 'known' else 'unfinished' end;
    show_count_value := greatest(0, coalesce(nullif(word_row->>'show_count', '')::integer, 0));
    left_swipe_count_value := greatest(0, coalesce(nullif(word_row->>'left_swipe_count', '')::integer, 0));

    insert into public.learn_session_words (
      session_id, user_id, word_id, show_count, left_swipe_count,
      final_result, first_position
    ) values (
      session_uuid,
      owner_id,
      word_id_value,
      show_count_value,
      left_swipe_count_value,
      word_result,
      greatest(1, coalesce(nullif(word_row->>'first_position', '')::integer, word_index))
    )
    on conflict (session_id, word_id) do nothing;

    insert into public.user_word_progress (
      user_id, word_id, learn_sessions_total,
      learn_unfinished_total, study_shown_count, known_count,
      unknown_count, last_mode, last_result, last_seen_at,
      last_studied_at, mastery_status, updated_at
    ) values (
      owner_id,
      word_id_value,
      1,
      case when word_result = 'unfinished' then 1 else 0 end,
      show_count_value,
      case when word_result = 'known' then 1 else 0 end,
      left_swipe_count_value,
      'learn',
      word_result,
      session_ended,
      session_ended,
      'learning',
      now()
    )
    on conflict (user_id, word_id) do update set
      learn_sessions_total = public.user_word_progress.learn_sessions_total + 1,
      learn_unfinished_total = public.user_word_progress.learn_unfinished_total + excluded.learn_unfinished_total,
      study_shown_count = public.user_word_progress.study_shown_count + excluded.study_shown_count,
      known_count = public.user_word_progress.known_count + excluded.known_count,
      unknown_count = public.user_word_progress.unknown_count + excluded.unknown_count,
      last_mode = 'learn',
      last_result = excluded.last_result,
      last_seen_at = excluded.last_seen_at,
      last_studied_at = excluded.last_studied_at,
      mastery_status = case
        when public.user_word_progress.mastery_status = 'not_started' then 'learning'
        else public.user_word_progress.mastery_status
      end,
      updated_at = now();
  end loop;

  return jsonb_build_object('created', true, 'id', session_uuid);
end;
$function$;

CREATE OR REPLACE FUNCTION private.save_match_session(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  owner_id uuid := auth.uid();
  session_uuid uuid;
  session_status text;
  session_started timestamptz;
  session_ended timestamptz;
  inserted_rows integer := 0;
  word_row jsonb;
  error_row jsonb;
  word_id_value text;
  matched_value boolean;
  word_a text;
  word_b text;
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;
  if jsonb_typeof(coalesce(payload, '{}'::jsonb)) <> 'object' then
    raise exception 'Session payload must be an object';
  end if;

  session_uuid := nullif(payload->>'id', '')::uuid;
  if session_uuid is null then
    raise exception 'Session id is required';
  end if;
  session_status := case when payload->>'status' = 'completed' then 'completed' else 'interrupted' end;
  session_started := coalesce(nullif(payload->>'started_at', '')::timestamptz, now());
  session_ended := coalesce(nullif(payload->>'ended_at', '')::timestamptz, now());

  insert into public.match_sessions (
    id, user_id, selected_sources, translation_language_code,
    started_at, ended_at, duration_sec, active_duration_sec, status,
    exit_reason, pairs_planned, pairs_completed, errors_total,
    rounds_total
  ) values (
    session_uuid,
    owner_id,
    case when jsonb_typeof(payload->'selected_sources') = 'array' then payload->'selected_sources' else '[]'::jsonb end,
    coalesce(nullif(payload->>'translation_language_code', ''), 'ru'),
    session_started,
    session_ended,
    greatest(0, coalesce(nullif(payload->>'duration_sec', '')::integer, 0)),
    greatest(0, coalesce(nullif(payload->>'active_duration_sec', '')::integer, 0)),
    session_status,
    case when session_status = 'completed' then null else nullif(payload->>'exit_reason', '') end,
    greatest(0, coalesce(nullif(payload->>'pairs_planned', '')::integer, 0)),
    greatest(0, coalesce(nullif(payload->>'pairs_completed', '')::integer, 0)),
    greatest(0, coalesce(nullif(payload->>'errors_total', '')::integer, 0)),
    greatest(0, coalesce(nullif(payload->>'rounds_total', '')::integer, 0))
  )
  on conflict (id) do nothing;

  get diagnostics inserted_rows = row_count;
  if inserted_rows = 0 then
    return jsonb_build_object('created', false, 'id', session_uuid);
  end if;

  for word_row in
    select value from jsonb_array_elements(
      case when jsonb_typeof(payload->'words') = 'array' then payload->'words' else '[]'::jsonb end
    )
  loop
    word_id_value := btrim(coalesce(word_row->>'word_id', ''));
    if word_id_value = '' then
      continue;
    end if;
    if not exists (select 1 from public.content_words where word_id = word_id_value) then
      continue;
    end if;
    matched_value := coalesce((word_row->>'matched')::boolean, false);

    insert into public.match_session_words (
      session_id, user_id, word_id, matched, error_count
    ) values (
      session_uuid,
      owner_id,
      word_id_value,
      matched_value,
      greatest(0, coalesce(nullif(word_row->>'error_count', '')::integer, 0))
    )
    on conflict (session_id, word_id) do nothing;

    insert into public.user_word_progress (
      user_id, word_id, match_sessions_total,
      match_success_total, match_errors_total, last_mode, last_result,
      last_seen_at, mastery_status, updated_at
    ) values (
      owner_id,
      word_id_value,
      1,
      case when matched_value then 1 else 0 end,
      greatest(0, coalesce(nullif(word_row->>'error_count', '')::integer, 0)),
      'match',
      case when matched_value then 'matched' else 'unfinished' end,
      session_ended,
      'learning',
      now()
    )
    on conflict (user_id, word_id) do update set
      match_sessions_total = public.user_word_progress.match_sessions_total + 1,
      match_success_total = public.user_word_progress.match_success_total + excluded.match_success_total,
      match_errors_total = public.user_word_progress.match_errors_total + excluded.match_errors_total,
      last_mode = 'match',
      last_result = excluded.last_result,
      last_seen_at = excluded.last_seen_at,
      mastery_status = case
        when public.user_word_progress.mastery_status = 'not_started' then 'learning'
        else public.user_word_progress.mastery_status
      end,
      updated_at = now();
  end loop;

  for error_row in
    select value from jsonb_array_elements(
      case when jsonb_typeof(payload->'errors') = 'array' then payload->'errors' else '[]'::jsonb end
    )
  loop
    word_a := btrim(coalesce(error_row->>'word_id_a', ''));
    word_b := btrim(coalesce(error_row->>'word_id_b', ''));
    if word_a = '' or word_b = '' or word_a = word_b then
      continue;
    end if;
    insert into public.match_session_errors (
      session_id, user_id, word_id_a, word_id_b, error_count
    ) values (
      session_uuid,
      owner_id,
      least(word_a, word_b),
      greatest(word_a, word_b),
      greatest(1, coalesce(nullif(error_row->>'error_count', '')::integer, 1))
    )
    on conflict (session_id, word_id_a, word_id_b) do nothing;
  end loop;

  return jsonb_build_object('created', true, 'id', session_uuid);
end;
$function$;

CREATE OR REPLACE FUNCTION private.save_station_test_session(payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  owner_id uuid := auth.uid();
  session_uuid uuid;
  session_status text;
  session_phase text;
  session_started timestamptz;
  session_ended timestamptz;
  session_accuracy numeric;
  required_accuracy numeric;
  passed boolean;
  inserted_rows integer := 0;
  word_row jsonb;
  word_id_value text;
  word_result text;
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;
  if jsonb_typeof(coalesce(payload, '{}'::jsonb)) <> 'object' then
    raise exception 'Session payload must be an object';
  end if;

  session_uuid := nullif(payload->>'id', '')::uuid;
  if session_uuid is null then
    raise exception 'Session id is required';
  end if;
  session_status := case
    when payload->>'status' = 'completed' then 'completed'
    when payload->>'status' = 'active' then 'active'
    else 'interrupted'
  end;
  session_phase := case
    when payload->>'phase' in ('first_test', 'review_1', 'review_2', 'practice', 'milestone')
      then payload->>'phase'
    else 'practice'
  end;
  session_started := coalesce(nullif(payload->>'started_at', '')::timestamptz, now());
  session_ended := coalesce(nullif(payload->>'ended_at', '')::timestamptz, now());
  session_accuracy := least(100, greatest(0, coalesce(nullif(payload->>'accuracy', '')::numeric, 0)));
  required_accuracy := least(100, greatest(0, coalesce(nullif(payload->>'required_accuracy', '')::numeric, 80)));
  passed := session_status = 'completed' and session_accuracy >= required_accuracy;

  insert into public.station_test_sessions (
    id, user_id, dictionary_id, catalog_id, group_id, set_id,
    story_type, phase, status, questions_total, correct_total,
    wrong_total, accuracy, started_at, ended_at, duration_sec,
    active_duration_sec, direction, translation_language_code, required_accuracy, exit_reason
  ) values (
    session_uuid,
    owner_id,
    coalesce(payload->>'dictionary_id', ''),
    coalesce(payload->>'catalog_id', payload->>'dictionary_id', ''),
    coalesce(payload->>'group_id', payload->>'section_id', ''),
    coalesce(payload->>'set_id', ''),
    coalesce(nullif(payload->>'story_type', ''), 'ascent'),
    session_phase,
    session_status,
    greatest(0, coalesce(nullif(payload->>'questions_total', '')::integer, 0)),
    greatest(0, coalesce(nullif(payload->>'correct_total', '')::integer, 0)),
    greatest(0, coalesce(nullif(payload->>'wrong_total', '')::integer, 0)),
    session_accuracy,
    session_started,
    session_ended,
    greatest(0, coalesce(nullif(payload->>'duration_sec', '')::integer, 0)),
    greatest(0, coalesce(nullif(payload->>'active_duration_sec', '')::integer, 0)),
    case when payload->>'direction' in ('alan_ru', 'alan_to_ru', 'kb') then 'alan_ru'
      when payload->>'direction' in ('ru_alan', 'ru_to_alan', 'ru') then 'ru_alan' else null end,
    case when payload->>'translation_language_code' in ('ru', 'en', 'tr') then payload->>'translation_language_code' else null end,
    required_accuracy,
    case when session_status = 'completed' then null else nullif(payload->>'exit_reason', '') end
  )
  on conflict (id) do nothing;

  get diagnostics inserted_rows = row_count;
  if inserted_rows = 0 then
    return session_uuid;
  end if;

  for word_row in
    select value from jsonb_array_elements(
      case when jsonb_typeof(payload->'words') = 'array' then payload->'words' else '[]'::jsonb end
    )
  loop
    word_id_value := btrim(coalesce(word_row->>'word_id', ''));
    if word_id_value = '' then
      continue;
    end if;
    if not exists (select 1 from public.content_words where word_id = word_id_value) then
      continue;
    end if;
    word_result := case
      when word_row->>'result' = 'correct' or word_row->>'is_correct' = 'true' then 'correct'
      else 'wrong'
    end;

    insert into public.station_test_session_words (
      session_id, user_id, word_id, result, wrong_word_id
    ) values (
      session_uuid,
      owner_id,
      word_id_value,
      word_result,
      case when word_result = 'wrong'
        then nullif(btrim(coalesce(word_row->>'wrong_word_id', '')), '')
        else null
      end
    )
    on conflict (session_id, word_id) do nothing;
    get diagnostics inserted_rows = row_count;
    if inserted_rows = 0 then continue; end if;

    insert into public.user_word_progress (
      user_id, word_id, test_answers_total,
      test_correct_count, test_wrong_count, last_mode, last_result,
      last_seen_at, last_tested_at, mastery_status, mastered_at,
      updated_at
    ) values (
      owner_id,
      word_id_value,
      1,
      case when word_result = 'correct' then 1 else 0 end,
      case when word_result = 'wrong' then 1 else 0 end,
      'test',
      word_result,
      session_ended,
      session_ended,
      case when passed and word_result = 'correct' then 'mastered' else 'learning' end,
      case when passed and word_result = 'correct' then session_ended else null end,
      now()
    )
    on conflict (user_id, word_id) do update set
      test_answers_total = public.user_word_progress.test_answers_total + 1,
      test_correct_count = public.user_word_progress.test_correct_count + excluded.test_correct_count,
      test_wrong_count = public.user_word_progress.test_wrong_count + excluded.test_wrong_count,
      last_mode = 'test',
      last_result = excluded.last_result,
      last_seen_at = excluded.last_seen_at,
      last_tested_at = excluded.last_tested_at,
      mastery_status = case
        when word_result = 'wrong'
          and (
            public.user_word_progress.mastered_at is not null
            or public.user_word_progress.mastery_status in ('mastered', 'review')
          ) then 'review'
        when passed and word_result = 'correct' then 'mastered'
        when public.user_word_progress.mastery_status = 'not_started' then 'learning'
        else public.user_word_progress.mastery_status
      end,
      mastered_at = case
        when passed and word_result = 'correct'
          then coalesce(public.user_word_progress.mastered_at, excluded.mastered_at)
        else public.user_word_progress.mastered_at
      end,
      updated_at = now();
  end loop;

  return session_uuid;
end;
$function$;

CREATE OR REPLACE FUNCTION private.save_test_session(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  owner_id uuid := auth.uid();
  session_uuid uuid;
  session_status text;
  session_started timestamptz;
  session_ended timestamptz;
  inserted_rows integer := 0;
  word_row jsonb;
  word_id_value text;
  word_result text;
  wrong_word_id_value text;
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;
  if jsonb_typeof(coalesce(payload, '{}'::jsonb)) <> 'object' then
    raise exception 'Session payload must be an object';
  end if;

  session_uuid := nullif(payload->>'id', '')::uuid;
  if session_uuid is null then
    raise exception 'Session id is required';
  end if;
  session_status := case when payload->>'status' = 'completed' then 'completed' else 'interrupted' end;
  session_started := coalesce(nullif(payload->>'started_at', '')::timestamptz, now());
  session_ended := coalesce(nullif(payload->>'ended_at', '')::timestamptz, now());

  insert into public.test_sessions (
    id, user_id, selected_sources, direction, translation_language_code,
    started_at, ended_at, duration_sec, active_duration_sec, status,
    exit_reason, questions_planned, questions_answered, correct_total,
    wrong_total
  ) values (
    session_uuid,
    owner_id,
    case when jsonb_typeof(payload->'selected_sources') = 'array' then payload->'selected_sources' else '[]'::jsonb end,
    case when payload->>'direction' = 'ru_alan' then 'ru_alan' else 'alan_ru' end,
    coalesce(nullif(payload->>'translation_language_code', ''), 'ru'),
    session_started,
    session_ended,
    greatest(0, coalesce(nullif(payload->>'duration_sec', '')::integer, 0)),
    greatest(0, coalesce(nullif(payload->>'active_duration_sec', '')::integer, 0)),
    session_status,
    case when session_status = 'completed' then null else nullif(payload->>'exit_reason', '') end,
    greatest(0, coalesce(nullif(payload->>'questions_planned', '')::integer, 0)),
    greatest(0, coalesce(nullif(payload->>'questions_answered', '')::integer, 0)),
    greatest(0, coalesce(nullif(payload->>'correct_total', '')::integer, 0)),
    greatest(0, coalesce(nullif(payload->>'wrong_total', '')::integer, 0))
  )
  on conflict (id) do nothing;

  get diagnostics inserted_rows = row_count;
  if inserted_rows = 0 then
    return jsonb_build_object('created', false, 'id', session_uuid);
  end if;

  for word_row in
    select value from jsonb_array_elements(
      case when jsonb_typeof(payload->'words') = 'array' then payload->'words' else '[]'::jsonb end
    )
  loop
    word_id_value := btrim(coalesce(word_row->>'word_id', ''));
    if word_id_value = '' then
      continue;
    end if;
    if not exists (select 1 from public.content_words where word_id = word_id_value) then
      continue;
    end if;
    word_result := case when word_row->>'result' = 'correct' then 'correct' else 'wrong' end;
    wrong_word_id_value := nullif(btrim(coalesce(word_row->>'wrong_word_id', '')), '');
    if word_result = 'wrong' and wrong_word_id_value is null then
      raise exception 'wrong_word_id is required for a wrong test answer';
    end if;

    insert into public.test_session_words (
      session_id, user_id, word_id, result, wrong_word_id
    ) values (
      session_uuid,
      owner_id,
      word_id_value,
      word_result,
      case when word_result = 'wrong' then wrong_word_id_value else null end
    )
    on conflict (session_id, word_id) do nothing;

    insert into public.user_word_progress (
      user_id, word_id, test_answers_total,
      test_correct_count, test_wrong_count, last_mode, last_result,
      last_seen_at, last_tested_at, mastery_status, updated_at
    ) values (
      owner_id,
      word_id_value,
      1,
      case when word_result = 'correct' then 1 else 0 end,
      case when word_result = 'wrong' then 1 else 0 end,
      'test',
      word_result,
      session_ended,
      session_ended,
      'learning',
      now()
    )
    on conflict (user_id, word_id) do update set
      test_answers_total = public.user_word_progress.test_answers_total + 1,
      test_correct_count = public.user_word_progress.test_correct_count + excluded.test_correct_count,
      test_wrong_count = public.user_word_progress.test_wrong_count + excluded.test_wrong_count,
      last_mode = 'test',
      last_result = excluded.last_result,
      last_seen_at = excluded.last_seen_at,
      last_tested_at = excluded.last_tested_at,
      mastery_status = case
        when public.user_word_progress.mastery_status = 'not_started' then 'learning'
        else public.user_word_progress.mastery_status
      end,
      updated_at = now();
  end loop;

  return jsonb_build_object('created', true, 'id', session_uuid);
end;
$function$;

drop trigger if exists trg_protect_word_progress_revision on public.user_word_progress;
create trigger trg_protect_word_progress_revision
before insert or update on public.user_word_progress
for each row execute function private.protect_word_progress_revision();

update public.user_word_progress
set sessions_total = learn_sessions_total + test_answers_total + match_sessions_total
where sessions_total is distinct from (learn_sessions_total + test_answers_total + match_sessions_total);

alter table public.user_word_progress
  drop column if exists learn_shows_total,
  drop column if exists learn_left_swipes_total,
  drop column if exists learn_known_total,
  drop column if exists test_correct_total,
  drop column if exists test_wrong_total;

alter table public.user_word_progress
  drop constraint if exists user_word_progress_sessions_total_derived;

alter table public.user_word_progress
  add constraint user_word_progress_sessions_total_derived
  check (sessions_total = learn_sessions_total + test_answers_total + match_sessions_total);

comment on column public.user_word_progress.sessions_total is
  'Compatibility aggregate derived from learn_sessions_total + test_answers_total + match_sessions_total; not an independent source of truth.';

commit;

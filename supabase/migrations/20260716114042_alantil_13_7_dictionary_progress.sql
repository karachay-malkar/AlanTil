-- AlanTil 13.7: canonical word progress and idempotent session RPCs.
--
-- This migration intentionally keeps the legacy compatibility view and the five
-- legacy counters.  The currently deployed 13.6 client still reads them.  The
-- follow-up cleanup migration may be applied only after the 13.7 client has been
-- verified in production.

begin;

alter table public.user_settings
  add column if not exists station_size smallint not null default 40,
  add column if not exists alan_script_code text not null default 'cyrillic',
  add column if not exists alan_dialect_code text not null default 'karachay';

alter table public.user_word_progress
  add column if not exists study_shown_count bigint not null default 0,
  add column if not exists known_count bigint not null default 0,
  add column if not exists unknown_count bigint not null default 0,
  add column if not exists test_correct_count bigint not null default 0,
  add column if not exists test_wrong_count bigint not null default 0,
  add column if not exists mastery_status text not null default 'not_started',
  add column if not exists last_studied_at timestamptz,
  add column if not exists last_tested_at timestamptz,
  add column if not exists mastered_at timestamptz;

update public.user_word_progress
set
  study_shown_count = greatest(study_shown_count, learn_shows_total::bigint),
  known_count = greatest(known_count, learn_known_total::bigint),
  unknown_count = greatest(unknown_count, learn_left_swipes_total::bigint),
  test_correct_count = greatest(test_correct_count, test_correct_total::bigint),
  test_wrong_count = greatest(test_wrong_count, test_wrong_total::bigint),
  mastered_at = case
    when mastery_status in ('mastered', 'review')
      then coalesce(mastered_at, last_tested_at, last_seen_at, updated_at)
    else mastered_at
  end;

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_settings'::regclass
      and conname = 'user_settings_station_size_check'
  ) then
    alter table public.user_settings
      add constraint user_settings_station_size_check
      check (station_size in (20, 40)) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_settings'::regclass
      and conname = 'user_settings_alan_script_code_check'
  ) then
    alter table public.user_settings
      add constraint user_settings_alan_script_code_check
      check (alan_script_code in ('cyrillic', 'turkic')) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_settings'::regclass
      and conname = 'user_settings_alan_dialect_code_check'
  ) then
    alter table public.user_settings
      add constraint user_settings_alan_dialect_code_check
      check (alan_dialect_code in ('karachay', 'balkar')) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_word_progress'::regclass
      and conname = 'user_word_progress_mastery_status_check'
  ) then
    alter table public.user_word_progress
      add constraint user_word_progress_mastery_status_check
      check (mastery_status in ('not_started', 'learning', 'mastered', 'review')) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_word_progress'::regclass
      and conname = 'user_word_progress_study_shown_count_check'
  ) then
    alter table public.user_word_progress
      add constraint user_word_progress_study_shown_count_check
      check (study_shown_count >= 0) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_word_progress'::regclass
      and conname = 'user_word_progress_known_count_check'
  ) then
    alter table public.user_word_progress
      add constraint user_word_progress_known_count_check
      check (known_count >= 0) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_word_progress'::regclass
      and conname = 'user_word_progress_unknown_count_check'
  ) then
    alter table public.user_word_progress
      add constraint user_word_progress_unknown_count_check
      check (unknown_count >= 0) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_word_progress'::regclass
      and conname = 'user_word_progress_test_correct_count_check'
  ) then
    alter table public.user_word_progress
      add constraint user_word_progress_test_correct_count_check
      check (test_correct_count >= 0) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_word_progress'::regclass
      and conname = 'user_word_progress_test_wrong_count_check'
  ) then
    alter table public.user_word_progress
      add constraint user_word_progress_test_wrong_count_check
      check (test_wrong_count >= 0) not valid;
  end if;
end
$constraints$;

alter table public.user_settings
  validate constraint user_settings_station_size_check;
alter table public.user_settings
  validate constraint user_settings_alan_script_code_check;
alter table public.user_settings
  validate constraint user_settings_alan_dialect_code_check;
alter table public.user_word_progress
  validate constraint user_word_progress_mastery_status_check;
alter table public.user_word_progress
  validate constraint user_word_progress_study_shown_count_check;
alter table public.user_word_progress
  validate constraint user_word_progress_known_count_check;
alter table public.user_word_progress
  validate constraint user_word_progress_unknown_count_check;
alter table public.user_word_progress
  validate constraint user_word_progress_test_correct_count_check;
alter table public.user_word_progress
  validate constraint user_word_progress_test_wrong_count_check;

create schema if not exists private;

create table if not exists private.word_progress_snapshot_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_id text not null check (char_length(btrim(snapshot_id)) > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, snapshot_id)
);

alter table private.word_progress_snapshot_receipts enable row level security;
revoke all on schema private from public, anon, authenticated;
revoke all on private.word_progress_snapshot_receipts from public, anon, authenticated;
drop policy if exists word_progress_snapshot_receipts_deny_direct on private.word_progress_snapshot_receipts;
create policy word_progress_snapshot_receipts_deny_direct
  on private.word_progress_snapshot_receipts
  for all to authenticated
  using (false)
  with check (false);
grant usage on schema private to authenticated, service_role;

create or replace function private.save_learn_session(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
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
      user_id, word_id, sessions_total, learn_sessions_total,
      learn_unfinished_total, study_shown_count, known_count,
      unknown_count, last_mode, last_result, last_seen_at,
      last_studied_at, mastery_status, updated_at
    ) values (
      owner_id,
      word_id_value,
      1,
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
      sessions_total = public.user_word_progress.sessions_total + 1,
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

create or replace function private.save_test_session(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
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
      user_id, word_id, sessions_total, test_answers_total,
      test_correct_count, test_wrong_count, last_mode, last_result,
      last_seen_at, last_tested_at, mastery_status, updated_at
    ) values (
      owner_id,
      word_id_value,
      1,
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
      sessions_total = public.user_word_progress.sessions_total + 1,
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

create or replace function private.save_station_test_session(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
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
    active_duration_sec
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
    greatest(0, coalesce(nullif(payload->>'active_duration_sec', '')::integer, 0))
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

    insert into public.user_word_progress (
      user_id, word_id, sessions_total, test_answers_total,
      test_correct_count, test_wrong_count, last_mode, last_result,
      last_seen_at, last_tested_at, mastery_status, mastered_at,
      updated_at
    ) values (
      owner_id,
      word_id_value,
      1,
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
      sessions_total = public.user_word_progress.sessions_total + 1,
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

create or replace function private.save_match_session(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
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
      user_id, word_id, sessions_total, match_sessions_total,
      match_success_total, match_errors_total, last_mode, last_result,
      last_seen_at, mastery_status, updated_at
    ) values (
      owner_id,
      word_id_value,
      1,
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
      sessions_total = public.user_word_progress.sessions_total + 1,
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

create or replace function private.merge_word_progress_snapshot(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
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
      user_id, word_id, sessions_total, learn_sessions_total,
      learn_unfinished_total, test_answers_total, match_sessions_total,
      match_success_total, match_errors_total, study_shown_count,
      known_count, unknown_count, test_correct_count, test_wrong_count,
      mastery_status, mastered_at, last_mode, last_result, last_seen_at,
      last_studied_at, last_tested_at, updated_at
    ) values (
      owner_id,
      word_id_value,
      greatest(0, coalesce(nullif(word_row->>'sessions_total', '')::integer, 0)),
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
      sessions_total = greatest(public.user_word_progress.sessions_total, excluded.sessions_total),
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

create or replace function public.save_learn_session(payload jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $wrapper$
  select private.save_learn_session(payload);
$wrapper$;

create or replace function public.save_test_session(payload jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $wrapper$
  select private.save_test_session(payload);
$wrapper$;

create or replace function public.save_station_test_session(payload jsonb)
returns uuid
language sql
security invoker
set search_path = ''
as $wrapper$
  select private.save_station_test_session(payload);
$wrapper$;

create or replace function public.save_match_session(payload jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $wrapper$
  select private.save_match_session(payload);
$wrapper$;

create or replace function public.merge_word_progress_snapshot(payload jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $wrapper$
  select private.merge_word_progress_snapshot(payload);
$wrapper$;

comment on function private.save_learn_session(jsonb) is
  'Idempotently stores a learning session and updates canonical word progress.';
comment on function private.save_test_session(jsonb) is
  'Idempotently stores a test session and updates canonical word progress.';
comment on function private.save_station_test_session(jsonb) is
  'Idempotently stores a station test and updates canonical mastery progress.';
comment on function private.save_match_session(jsonb) is
  'Idempotently stores a match session and updates canonical word progress.';
comment on function private.merge_word_progress_snapshot(jsonb) is
  'Idempotently merges one guest progress snapshot without reducing cloud values.';

revoke all on function private.save_learn_session(jsonb) from public, anon;
revoke all on function private.save_test_session(jsonb) from public, anon;
revoke all on function private.save_station_test_session(jsonb) from public, anon;
revoke all on function private.save_match_session(jsonb) from public, anon;
revoke all on function private.merge_word_progress_snapshot(jsonb) from public, anon;

grant execute on function private.save_learn_session(jsonb) to authenticated, service_role;
grant execute on function private.save_test_session(jsonb) to authenticated, service_role;
grant execute on function private.save_station_test_session(jsonb) to authenticated, service_role;
grant execute on function private.save_match_session(jsonb) to authenticated, service_role;
grant execute on function private.merge_word_progress_snapshot(jsonb) to authenticated, service_role;

revoke all on function public.save_learn_session(jsonb) from public, anon;
revoke all on function public.save_test_session(jsonb) from public, anon;
revoke all on function public.save_station_test_session(jsonb) from public, anon;
revoke all on function public.save_match_session(jsonb) from public, anon;
revoke all on function public.merge_word_progress_snapshot(jsonb) from public, anon;

grant execute on function public.save_learn_session(jsonb) to authenticated, service_role;
grant execute on function public.save_test_session(jsonb) to authenticated, service_role;
grant execute on function public.save_station_test_session(jsonb) to authenticated, service_role;
grant execute on function public.save_match_session(jsonb) to authenticated, service_role;
grant execute on function public.merge_word_progress_snapshot(jsonb) to authenticated, service_role;

revoke all on public.learn_sessions from authenticated;
revoke all on public.learn_session_words from authenticated;
revoke all on public.test_sessions from authenticated;
revoke all on public.test_session_words from authenticated;
revoke all on public.station_test_sessions from authenticated;
revoke all on public.station_test_session_words from authenticated;
revoke all on public.match_sessions from authenticated;
revoke all on public.match_session_words from authenticated;
revoke all on public.match_session_errors from authenticated;
revoke all on public.user_word_progress from authenticated;

grant select on public.learn_sessions to authenticated;
grant select on public.learn_session_words to authenticated;
grant select on public.test_sessions to authenticated;
grant select on public.test_session_words to authenticated;
grant select on public.station_test_sessions to authenticated;
grant select on public.station_test_session_words to authenticated;
grant select on public.match_sessions to authenticated;
grant select on public.match_session_words to authenticated;
grant select on public.match_session_errors to authenticated;
grant select on public.user_word_progress to authenticated;

notify pgrst, 'reload schema';

commit;

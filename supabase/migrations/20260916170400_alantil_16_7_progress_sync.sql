begin;

-- 16.7 extends the existing idempotent mobile snapshot merge with mastery_percent.
-- The public wrapper already delegates to this private function, so replacing the
-- private implementation keeps the API contract unchanged.
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
      mastery_percent, mastery_status, mastered_at, last_mode, last_result,
      last_seen_at, last_studied_at, last_tested_at, updated_at
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

commit;

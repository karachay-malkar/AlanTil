-- AlanTil 13.1 — station path, reviews and rewards.
-- Safe to run after the 12.4 schema. Existing tables and RPC functions are not removed.

create table if not exists public.user_station_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  dictionary_id text not null,
  catalog_id text not null,
  group_id text not null,
  set_id text not null,
  story_type text not null check (story_type in ('ascent', 'summit', 'trails')),
  status text not null default 'available' check (status in (
    'locked', 'available', 'studying', 'test_ready',
    'review_1_waiting', 'review_1_due',
    'review_2_waiting', 'review_2_due', 'mastered'
  )),
  current_phase text not null default 'study',
  study_sessions_total integer not null default 0 check (study_sessions_total >= 0),
  test_attempts_total integer not null default 0 check (test_attempts_total >= 0),
  best_accuracy numeric(5,2) not null default 0 check (best_accuracy between 0 and 100),
  first_test_completed_at timestamptz,
  review_1_due_at timestamptz,
  review_1_completed_at timestamptz,
  review_2_due_at timestamptz,
  review_2_completed_at timestamptz,
  mastered_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, dictionary_id, catalog_id, group_id, set_id)
);

create index if not exists user_station_progress_due_idx
  on public.user_station_progress (user_id, review_1_due_at, review_2_due_at);
create index if not exists user_station_progress_story_idx
  on public.user_station_progress (user_id, story_type, status);

create table if not exists public.station_test_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  dictionary_id text not null,
  catalog_id text not null,
  group_id text not null,
  set_id text not null,
  story_type text not null check (story_type in ('ascent', 'summit', 'trails')),
  phase text not null check (phase in ('first_test', 'review_1', 'review_2', 'practice', 'milestone')),
  status text not null check (status in ('active', 'completed', 'interrupted')),
  questions_total integer not null default 0 check (questions_total >= 0),
  correct_total integer not null default 0 check (correct_total >= 0),
  wrong_total integer not null default 0 check (wrong_total >= 0),
  accuracy numeric(5,2) not null default 0 check (accuracy between 0 and 100),
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_sec integer not null default 0 check (duration_sec >= 0),
  active_duration_sec integer not null default 0 check (active_duration_sec >= 0),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create index if not exists station_test_sessions_user_station_idx
  on public.station_test_sessions (user_id, dictionary_id, catalog_id, group_id, set_id, created_at desc);

create table if not exists public.station_test_session_words (
  session_id uuid not null,
  user_id uuid not null,
  word_id text not null,
  result text not null check (result in ('correct', 'wrong')),
  wrong_word_id text,
  primary key (session_id, word_id),
  foreign key (session_id, user_id)
    references public.station_test_sessions(id, user_id)
    on delete cascade
);

create table if not exists public.user_rewards (
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_id text not null,
  set_id text,
  group_id text,
  catalog_id text,
  acquired_at timestamptz not null default now(),
  primary key (user_id, reward_id)
);

create table if not exists public.user_route_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  selected_dictionary_id text not null default 'alantil-kb-ru',
  active_story text not null default 'ascent' check (active_story in ('ascent', 'summit', 'trails')),
  selected_background_route text not null default 'first-gorge',
  updated_at timestamptz not null default now()
);

alter table public.user_station_progress enable row level security;
alter table public.station_test_sessions enable row level security;
alter table public.station_test_session_words enable row level security;
alter table public.user_rewards enable row level security;
alter table public.user_route_settings enable row level security;

revoke all on public.user_station_progress from anon;
revoke all on public.station_test_sessions from anon;
revoke all on public.station_test_session_words from anon;
revoke all on public.user_rewards from anon;
revoke all on public.user_route_settings from anon;

grant select, insert, update, delete on public.user_station_progress to authenticated;
grant select, insert, update, delete on public.station_test_sessions to authenticated;
grant select, insert, update, delete on public.station_test_session_words to authenticated;
grant select, insert, update, delete on public.user_rewards to authenticated;
grant select, insert, update, delete on public.user_route_settings to authenticated;

drop policy if exists user_station_progress_own on public.user_station_progress;
create policy user_station_progress_own on public.user_station_progress
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists station_test_sessions_own on public.station_test_sessions;
create policy station_test_sessions_own on public.station_test_sessions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists station_test_session_words_own on public.station_test_session_words;
create policy station_test_session_words_own on public.station_test_session_words
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists user_rewards_own on public.user_rewards;
create policy user_rewards_own on public.user_rewards
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists user_route_settings_own on public.user_route_settings;
create policy user_route_settings_own on public.user_route_settings
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.save_station_test_session(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid := (payload->>'id')::uuid;
  v_inserted integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.station_test_sessions (
    id, user_id, dictionary_id, catalog_id, group_id, set_id, story_type,
    phase, status, questions_total, correct_total, wrong_total, accuracy,
    started_at, ended_at, duration_sec, active_duration_sec, created_at
  ) values (
    v_session_id,
    v_user_id,
    coalesce(payload->>'dictionary_id', ''),
    coalesce(payload->>'catalog_id', ''),
    coalesce(payload->>'group_id', ''),
    coalesce(payload->>'set_id', ''),
    coalesce(payload->>'story_type', 'ascent'),
    coalesce(payload->>'phase', 'first_test'),
    coalesce(payload->>'status', 'completed'),
    greatest(0, coalesce((payload->>'questions_total')::integer, 0)),
    greatest(0, coalesce((payload->>'correct_total')::integer, 0)),
    greatest(0, coalesce((payload->>'wrong_total')::integer, 0)),
    least(100, greatest(0, coalesce((payload->>'accuracy')::numeric, 0))),
    coalesce((payload->>'started_at')::timestamptz, now()),
    nullif(payload->>'ended_at', '')::timestamptz,
    greatest(0, coalesce((payload->>'duration_sec')::integer, 0)),
    greatest(0, coalesce((payload->>'active_duration_sec')::integer, 0)),
    coalesce((payload->>'created_at')::timestamptz, now())
  )
  on conflict (id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    insert into public.station_test_session_words (
      session_id, user_id, word_id, result, wrong_word_id
    )
    select
      v_session_id,
      v_user_id,
      item->>'word_id',
      case when item->>'result' = 'correct' then 'correct' else 'wrong' end,
      nullif(item->>'wrong_word_id', '')
    from jsonb_array_elements(coalesce(payload->'words', '[]'::jsonb)) as item
    where nullif(item->>'word_id', '') is not null
    on conflict (session_id, word_id) do nothing;
  end if;

  return v_session_id;
end;
$$;

revoke all on function public.save_station_test_session(jsonb) from public;
revoke all on function public.save_station_test_session(jsonb) from anon;
grant execute on function public.save_station_test_session(jsonb) to authenticated;

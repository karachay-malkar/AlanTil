-- AlanTil 13.7
-- Run this file in Supabase Dashboard -> SQL Editor.
-- It is safe to run repeatedly.

begin;

-- =========================================================
-- ACCOUNT PROFILE
-- =========================================================

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  avatar_gender text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_nickname_length check (char_length(nickname) between 3 and 30),
  constraint profiles_nickname_trimmed check (nickname = btrim(nickname)),
  constraint profiles_nickname_characters check (nickname ~ '^[[:alnum:]_]+$'),
  constraint profiles_avatar_gender check (avatar_gender is null or avatar_gender in ('male', 'female'))
);

alter table public.profiles add column if not exists avatar_gender text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_avatar_gender'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_avatar_gender
      check (avatar_gender is null or avatar_gender in ('male', 'female'));
  end if;
end;
$$;

create unique index if not exists profiles_nickname_unique_ci
  on public.profiles (lower(nickname));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.protect_avatar_gender()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.avatar_gender is not null and new.avatar_gender is distinct from old.avatar_gender then
    raise exception 'avatar_gender cannot be changed after selection';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_avatar_gender on public.profiles;
create trigger profiles_protect_avatar_gender
before update of avatar_gender on public.profiles
for each row execute function public.protect_avatar_gender();

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.is_nickname_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    candidate is not null
    and char_length(btrim(candidate)) between 3 and 30
    and btrim(candidate) ~ '^[[:alnum:]_]+$'
    and not exists (
      select 1 from public.profiles
      where lower(nickname) = lower(btrim(candidate))
    );
$$;

revoke execute on function public.is_nickname_available(text) from public, anon;
grant execute on function public.is_nickname_available(text) to authenticated;

-- =========================================================
-- DICTIONARY VERSION
-- =========================================================

create table if not exists public.dictionary_metadata (
  dictionary_key text primary key,
  current_version text not null,
  constraint dictionary_metadata_key_not_empty check (char_length(btrim(dictionary_key)) > 0),
  constraint dictionary_metadata_version_not_empty check (char_length(btrim(current_version)) > 0)
);

insert into public.dictionary_metadata (dictionary_key, current_version)
values ('main', '05.07.2026')
on conflict (dictionary_key) do nothing;

alter table public.dictionary_metadata enable row level security;
revoke all on public.dictionary_metadata from public;
grant select on public.dictionary_metadata to anon, authenticated;

drop policy if exists dictionary_metadata_read on public.dictionary_metadata;
create policy dictionary_metadata_read on public.dictionary_metadata
for select to anon, authenticated
using (true);

-- =========================================================
-- USER SETTINGS AND SYNCHRONIZED STATES
-- =========================================================

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  interface_language_code text not null default 'ru',
  translation_language_code text not null default 'ru',
  updated_at timestamptz not null default now(),
  constraint user_settings_interface_language_format
    check (interface_language_code ~ '^[a-z]{2,8}(-[a-z0-9]{2,8})?$'),
  constraint user_settings_translation_language_format
    check (translation_language_code ~ '^[a-z]{2,8}(-[a-z0-9]{2,8})?$')
);

create table if not exists public.user_word_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id text not null,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, word_id),
  constraint user_word_favorites_word_not_empty check (char_length(btrim(word_id)) > 0)
);

create table if not exists public.user_song_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  song_id text not null,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, song_id),
  constraint user_song_favorites_song_not_empty check (char_length(btrim(song_id)) > 0)
);

create table if not exists public.user_hidden_words (
  user_id uuid not null references auth.users(id) on delete cascade,
  dictionary_id text not null,
  section_id text not null,
  set_id text not null,
  word_id text not null,
  is_hidden boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, dictionary_id, section_id, set_id, word_id)
);

create table if not exists public.user_set_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  dictionary_id text not null,
  section_id text not null,
  set_id text not null,
  launches_total integer not null default 0 check (launches_total >= 0),
  completed_total integer not null default 0 check (completed_total >= 0),
  is_finished boolean not null default false,
  last_started_at timestamptz,
  last_completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, dictionary_id, section_id, set_id)
);

-- =========================================================
-- LEARN SESSIONS
-- =========================================================

create table if not exists public.learn_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  dictionary_id text not null,
  section_id text not null,
  set_id text not null,
  direction text not null check (direction in ('alan_ru', 'ru_alan')),
  translation_language_code text not null default 'ru',
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_sec integer not null default 0 check (duration_sec >= 0),
  active_duration_sec integer not null default 0 check (active_duration_sec >= 0),
  status text not null check (status in ('completed', 'interrupted')),
  exit_reason text,
  words_planned integer not null default 0 check (words_planned >= 0),
  unique_words_shown integer not null default 0 check (unique_words_shown >= 0),
  card_shows_total integer not null default 0 check (card_shows_total >= 0),
  left_swipes_total integer not null default 0 check (left_swipes_total >= 0),
  known_words_total integer not null default 0 check (known_words_total >= 0),
  unfinished_words_total integer not null default 0 check (unfinished_words_total >= 0),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.learn_session_words (
  session_id uuid not null,
  user_id uuid not null,
  word_id text not null,
  show_count integer not null default 0 check (show_count >= 0),
  left_swipe_count integer not null default 0 check (left_swipe_count >= 0),
  final_result text not null check (final_result in ('known', 'unfinished')),
  first_position integer not null check (first_position > 0),
  primary key (session_id, word_id),
  foreign key (session_id, user_id)
    references public.learn_sessions(id, user_id) on delete cascade
);

-- =========================================================
-- TEST SESSIONS
-- =========================================================

create table if not exists public.test_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  selected_sources jsonb not null default '[]'::jsonb,
  direction text not null check (direction in ('alan_ru', 'ru_alan')),
  translation_language_code text not null default 'ru',
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_sec integer not null default 0 check (duration_sec >= 0),
  active_duration_sec integer not null default 0 check (active_duration_sec >= 0),
  status text not null check (status in ('completed', 'interrupted')),
  exit_reason text,
  questions_planned integer not null default 0 check (questions_planned >= 0),
  questions_answered integer not null default 0 check (questions_answered >= 0),
  correct_total integer not null default 0 check (correct_total >= 0),
  wrong_total integer not null default 0 check (wrong_total >= 0),
  created_at timestamptz not null default now(),
  constraint test_sessions_sources_array check (jsonb_typeof(selected_sources) = 'array'),
  unique (id, user_id)
);

create table if not exists public.test_session_words (
  session_id uuid not null,
  user_id uuid not null,
  word_id text not null,
  result text not null check (result in ('correct', 'wrong')),
  wrong_word_id text,
  primary key (session_id, word_id),
  foreign key (session_id, user_id)
    references public.test_sessions(id, user_id) on delete cascade,
  constraint test_session_words_wrong_choice
    check ((result = 'correct' and wrong_word_id is null) or (result = 'wrong' and wrong_word_id is not null))
);

-- =========================================================
-- MATCH SESSIONS
-- =========================================================

create table if not exists public.match_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  selected_sources jsonb not null default '[]'::jsonb,
  translation_language_code text not null default 'ru',
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_sec integer not null default 0 check (duration_sec >= 0),
  active_duration_sec integer not null default 0 check (active_duration_sec >= 0),
  status text not null check (status in ('completed', 'interrupted')),
  exit_reason text,
  pairs_planned integer not null default 0 check (pairs_planned >= 0),
  pairs_completed integer not null default 0 check (pairs_completed >= 0),
  errors_total integer not null default 0 check (errors_total >= 0),
  rounds_total integer not null default 0 check (rounds_total >= 0),
  created_at timestamptz not null default now(),
  constraint match_sessions_sources_array check (jsonb_typeof(selected_sources) = 'array'),
  unique (id, user_id)
);

create table if not exists public.match_session_words (
  session_id uuid not null,
  user_id uuid not null,
  word_id text not null,
  matched boolean not null default false,
  error_count integer not null default 0 check (error_count >= 0),
  primary key (session_id, word_id),
  foreign key (session_id, user_id)
    references public.match_sessions(id, user_id) on delete cascade
);

create table if not exists public.match_session_errors (
  session_id uuid not null,
  user_id uuid not null,
  word_id_a text not null,
  word_id_b text not null,
  error_count integer not null default 1 check (error_count > 0),
  primary key (session_id, word_id_a, word_id_b),
  foreign key (session_id, user_id)
    references public.match_sessions(id, user_id) on delete cascade,
  constraint match_session_errors_ordered check (word_id_a < word_id_b)
);

-- =========================================================
-- ACCUMULATED WORD PROGRESS
-- =========================================================

create table if not exists public.user_word_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id text not null,
  sessions_total integer not null default 0 check (sessions_total >= 0),
  last_mode text check (last_mode in ('learn', 'test', 'match')),
  last_result text,
  last_seen_at timestamptz,

  learn_sessions_total integer not null default 0 check (learn_sessions_total >= 0),
  learn_shows_total integer not null default 0 check (learn_shows_total >= 0),
  learn_left_swipes_total integer not null default 0 check (learn_left_swipes_total >= 0),
  learn_known_total integer not null default 0 check (learn_known_total >= 0),
  learn_unfinished_total integer not null default 0 check (learn_unfinished_total >= 0),

  test_answers_total integer not null default 0 check (test_answers_total >= 0),
  test_correct_total integer not null default 0 check (test_correct_total >= 0),
  test_wrong_total integer not null default 0 check (test_wrong_total >= 0),

  match_sessions_total integer not null default 0 check (match_sessions_total >= 0),
  match_success_total integer not null default 0 check (match_success_total >= 0),
  match_errors_total integer not null default 0 check (match_errors_total >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, word_id)
);

-- =========================================================
-- INDEXES
-- =========================================================

create index if not exists learn_sessions_user_started_idx on public.learn_sessions (user_id, started_at desc);
create index if not exists test_sessions_user_started_idx on public.test_sessions (user_id, started_at desc);
create index if not exists match_sessions_user_started_idx on public.match_sessions (user_id, started_at desc);
create index if not exists learn_session_words_user_idx on public.learn_session_words (user_id, word_id);
create index if not exists test_session_words_user_idx on public.test_session_words (user_id, word_id);
create index if not exists match_session_words_user_idx on public.match_session_words (user_id, word_id);
create index if not exists match_session_errors_user_idx on public.match_session_errors (user_id, word_id_a, word_id_b);
create index if not exists user_word_progress_updated_idx on public.user_word_progress (user_id, updated_at desc);
create index if not exists user_word_favorites_updated_idx on public.user_word_favorites (user_id, updated_at desc);
create index if not exists user_song_favorites_updated_idx on public.user_song_favorites (user_id, updated_at desc);
create index if not exists user_hidden_words_updated_idx on public.user_hidden_words (user_id, updated_at desc);
create index if not exists user_set_progress_updated_idx on public.user_set_progress (user_id, updated_at desc);

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

alter table public.user_settings enable row level security;
alter table public.user_word_favorites enable row level security;
alter table public.user_song_favorites enable row level security;
alter table public.user_hidden_words enable row level security;
alter table public.user_set_progress enable row level security;
alter table public.learn_sessions enable row level security;
alter table public.learn_session_words enable row level security;
alter table public.test_sessions enable row level security;
alter table public.test_session_words enable row level security;
alter table public.match_sessions enable row level security;
alter table public.match_session_words enable row level security;
alter table public.match_session_errors enable row level security;
alter table public.user_word_progress enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'user_settings', 'user_word_favorites', 'user_song_favorites',
    'user_hidden_words', 'user_set_progress'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select_own', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      table_name || '_select_own', table_name
    );
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_own', table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      table_name || '_insert_own', table_name
    );
    execute format('drop policy if exists %I on public.%I', table_name || '_update_own', table_name);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      table_name || '_update_own', table_name
    );
  end loop;

  foreach table_name in array array[
    'learn_sessions', 'learn_session_words', 'test_sessions', 'test_session_words',
    'match_sessions', 'match_session_words', 'match_session_errors', 'user_word_progress'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select_own', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      table_name || '_select_own', table_name
    );
  end loop;
end;
$$;

revoke all on table
  public.user_settings,
  public.user_word_favorites,
  public.user_song_favorites,
  public.user_hidden_words,
  public.user_set_progress,
  public.learn_sessions,
  public.learn_session_words,
  public.test_sessions,
  public.test_session_words,
  public.match_sessions,
  public.match_session_words,
  public.match_session_errors,
  public.user_word_progress
from anon;

grant select, insert, update on table
  public.user_settings,
  public.user_word_favorites,
  public.user_song_favorites,
  public.user_hidden_words,
  public.user_set_progress
to authenticated;

grant select on table
  public.learn_sessions,
  public.learn_session_words,
  public.test_sessions,
  public.test_session_words,
  public.match_sessions,
  public.match_session_words,
  public.match_session_errors,
  public.user_word_progress
to authenticated;

-- =========================================================
-- ATOMIC SESSION SAVING
-- =========================================================

create or replace function public.save_learn_session(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  session_uuid uuid;
  session_status text;
  inserted_rows integer := 0;
  word_row jsonb;
  word_result text;
  session_started timestamptz;
  session_ended timestamptz;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  session_uuid := (payload->>'id')::uuid;
  session_status := case when payload->>'status' = 'completed' then 'completed' else 'interrupted' end;
  session_started := (payload->>'started_at')::timestamptz;
  session_ended := (payload->>'ended_at')::timestamptz;

  insert into public.learn_sessions (
    id, user_id, dictionary_id, section_id, set_id, direction,
    translation_language_code, started_at, ended_at, duration_sec,
    active_duration_sec, status, exit_reason, words_planned,
    unique_words_shown, card_shows_total, left_swipes_total,
    known_words_total, unfinished_words_total
  ) values (
    session_uuid, owner_id, coalesce(payload->>'dictionary_id', ''),
    coalesce(payload->>'section_id', ''), coalesce(payload->>'set_id', ''),
    payload->>'direction', coalesce(payload->>'translation_language_code', 'ru'),
    session_started, session_ended,
    greatest(0, coalesce((payload->>'duration_sec')::integer, 0)),
    greatest(0, coalesce((payload->>'active_duration_sec')::integer, 0)),
    session_status, nullif(payload->>'exit_reason', ''),
    greatest(0, coalesce((payload->>'words_planned')::integer, 0)),
    greatest(0, coalesce((payload->>'unique_words_shown')::integer, 0)),
    greatest(0, coalesce((payload->>'card_shows_total')::integer, 0)),
    greatest(0, coalesce((payload->>'left_swipes_total')::integer, 0)),
    greatest(0, coalesce((payload->>'known_words_total')::integer, 0)),
    greatest(0, coalesce((payload->>'unfinished_words_total')::integer, 0))
  ) on conflict (id) do nothing;

  get diagnostics inserted_rows = row_count;
  if inserted_rows = 0 then
    return jsonb_build_object('created', false, 'id', session_uuid);
  end if;

  for word_row in select value from jsonb_array_elements(coalesce(payload->'words', '[]'::jsonb)) loop
    word_result := case when word_row->>'final_result' = 'known' then 'known' else 'unfinished' end;
    insert into public.learn_session_words (
      session_id, user_id, word_id, show_count, left_swipe_count, final_result, first_position
    ) values (
      session_uuid, owner_id, word_row->>'word_id',
      greatest(0, coalesce((word_row->>'show_count')::integer, 0)),
      greatest(0, coalesce((word_row->>'left_swipe_count')::integer, 0)),
      word_result,
      greatest(1, coalesce((word_row->>'first_position')::integer, 1))
    );

    insert into public.user_word_progress (
      user_id, word_id, sessions_total, last_mode, last_result, last_seen_at,
      learn_sessions_total, learn_shows_total, learn_left_swipes_total,
      learn_known_total, learn_unfinished_total
    ) values (
      owner_id, word_row->>'word_id', 1, 'learn', word_result, session_ended,
      1,
      greatest(0, coalesce((word_row->>'show_count')::integer, 0)),
      greatest(0, coalesce((word_row->>'left_swipe_count')::integer, 0)),
      case when word_result = 'known' then 1 else 0 end,
      case when word_result = 'unfinished' then 1 else 0 end
    ) on conflict (user_id, word_id) do update set
      sessions_total = public.user_word_progress.sessions_total + 1,
      last_mode = 'learn',
      last_result = excluded.last_result,
      last_seen_at = excluded.last_seen_at,
      learn_sessions_total = public.user_word_progress.learn_sessions_total + 1,
      learn_shows_total = public.user_word_progress.learn_shows_total + excluded.learn_shows_total,
      learn_left_swipes_total = public.user_word_progress.learn_left_swipes_total + excluded.learn_left_swipes_total,
      learn_known_total = public.user_word_progress.learn_known_total + excluded.learn_known_total,
      learn_unfinished_total = public.user_word_progress.learn_unfinished_total + excluded.learn_unfinished_total,
      updated_at = now();
  end loop;

  if coalesce(payload->>'dictionary_id', '') <> '__fav__'
     and coalesce(payload->>'dictionary_id', '') <> '' then
    insert into public.user_set_progress (
      user_id, dictionary_id, section_id, set_id,
      launches_total, completed_total, last_started_at, last_completed_at
    ) values (
      owner_id, payload->>'dictionary_id', coalesce(payload->>'section_id', ''),
      coalesce(payload->>'set_id', ''), 1,
      case when session_status = 'completed' then 1 else 0 end,
      session_started,
      case when session_status = 'completed' then session_ended else null end
    ) on conflict (user_id, dictionary_id, section_id, set_id) do update set
      launches_total = public.user_set_progress.launches_total + 1,
      completed_total = public.user_set_progress.completed_total + excluded.completed_total,
      last_started_at = excluded.last_started_at,
      last_completed_at = coalesce(excluded.last_completed_at, public.user_set_progress.last_completed_at),
      updated_at = now();
  end if;

  return jsonb_build_object('created', true, 'id', session_uuid);
end;
$$;

create or replace function public.save_test_session(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  session_uuid uuid;
  session_status text;
  inserted_rows integer := 0;
  word_row jsonb;
  word_result text;
  session_ended timestamptz;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  session_uuid := (payload->>'id')::uuid;
  session_status := case when payload->>'status' = 'completed' then 'completed' else 'interrupted' end;
  session_ended := (payload->>'ended_at')::timestamptz;

  insert into public.test_sessions (
    id, user_id, selected_sources, direction, translation_language_code,
    started_at, ended_at, duration_sec, active_duration_sec, status,
    exit_reason, questions_planned, questions_answered, correct_total, wrong_total
  ) values (
    session_uuid, owner_id, coalesce(payload->'selected_sources', '[]'::jsonb),
    payload->>'direction', coalesce(payload->>'translation_language_code', 'ru'),
    (payload->>'started_at')::timestamptz, session_ended,
    greatest(0, coalesce((payload->>'duration_sec')::integer, 0)),
    greatest(0, coalesce((payload->>'active_duration_sec')::integer, 0)),
    session_status, nullif(payload->>'exit_reason', ''),
    greatest(0, coalesce((payload->>'questions_planned')::integer, 0)),
    greatest(0, coalesce((payload->>'questions_answered')::integer, 0)),
    greatest(0, coalesce((payload->>'correct_total')::integer, 0)),
    greatest(0, coalesce((payload->>'wrong_total')::integer, 0))
  ) on conflict (id) do nothing;

  get diagnostics inserted_rows = row_count;
  if inserted_rows = 0 then
    return jsonb_build_object('created', false, 'id', session_uuid);
  end if;

  for word_row in select value from jsonb_array_elements(coalesce(payload->'words', '[]'::jsonb)) loop
    word_result := case when word_row->>'result' = 'correct' then 'correct' else 'wrong' end;
    insert into public.test_session_words (
      session_id, user_id, word_id, result, wrong_word_id
    ) values (
      session_uuid, owner_id, word_row->>'word_id', word_result,
      case when word_result = 'wrong' then nullif(word_row->>'wrong_word_id', '') else null end
    );

    insert into public.user_word_progress (
      user_id, word_id, sessions_total, last_mode, last_result, last_seen_at,
      test_answers_total, test_correct_total, test_wrong_total
    ) values (
      owner_id, word_row->>'word_id', 1, 'test', word_result, session_ended,
      1,
      case when word_result = 'correct' then 1 else 0 end,
      case when word_result = 'wrong' then 1 else 0 end
    ) on conflict (user_id, word_id) do update set
      sessions_total = public.user_word_progress.sessions_total + 1,
      last_mode = 'test',
      last_result = excluded.last_result,
      last_seen_at = excluded.last_seen_at,
      test_answers_total = public.user_word_progress.test_answers_total + 1,
      test_correct_total = public.user_word_progress.test_correct_total + excluded.test_correct_total,
      test_wrong_total = public.user_word_progress.test_wrong_total + excluded.test_wrong_total,
      updated_at = now();
  end loop;

  return jsonb_build_object('created', true, 'id', session_uuid);
end;
$$;

create or replace function public.save_match_session(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  session_uuid uuid;
  session_status text;
  inserted_rows integer := 0;
  word_row jsonb;
  error_row jsonb;
  word_result text;
  session_ended timestamptz;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  session_uuid := (payload->>'id')::uuid;
  session_status := case when payload->>'status' = 'completed' then 'completed' else 'interrupted' end;
  session_ended := (payload->>'ended_at')::timestamptz;

  insert into public.match_sessions (
    id, user_id, selected_sources, translation_language_code,
    started_at, ended_at, duration_sec, active_duration_sec, status,
    exit_reason, pairs_planned, pairs_completed, errors_total, rounds_total
  ) values (
    session_uuid, owner_id, coalesce(payload->'selected_sources', '[]'::jsonb),
    coalesce(payload->>'translation_language_code', 'ru'),
    (payload->>'started_at')::timestamptz, session_ended,
    greatest(0, coalesce((payload->>'duration_sec')::integer, 0)),
    greatest(0, coalesce((payload->>'active_duration_sec')::integer, 0)),
    session_status, nullif(payload->>'exit_reason', ''),
    greatest(0, coalesce((payload->>'pairs_planned')::integer, 0)),
    greatest(0, coalesce((payload->>'pairs_completed')::integer, 0)),
    greatest(0, coalesce((payload->>'errors_total')::integer, 0)),
    greatest(0, coalesce((payload->>'rounds_total')::integer, 0))
  ) on conflict (id) do nothing;

  get diagnostics inserted_rows = row_count;
  if inserted_rows = 0 then
    return jsonb_build_object('created', false, 'id', session_uuid);
  end if;

  for word_row in select value from jsonb_array_elements(coalesce(payload->'words', '[]'::jsonb)) loop
    word_result := case when coalesce((word_row->>'matched')::boolean, false) then 'matched' else 'unfinished' end;
    insert into public.match_session_words (
      session_id, user_id, word_id, matched, error_count
    ) values (
      session_uuid, owner_id, word_row->>'word_id',
      coalesce((word_row->>'matched')::boolean, false),
      greatest(0, coalesce((word_row->>'error_count')::integer, 0))
    );

    insert into public.user_word_progress (
      user_id, word_id, sessions_total, last_mode, last_result, last_seen_at,
      match_sessions_total, match_success_total, match_errors_total
    ) values (
      owner_id, word_row->>'word_id', 1, 'match', word_result, session_ended,
      1,
      case when coalesce((word_row->>'matched')::boolean, false) then 1 else 0 end,
      greatest(0, coalesce((word_row->>'error_count')::integer, 0))
    ) on conflict (user_id, word_id) do update set
      sessions_total = public.user_word_progress.sessions_total + 1,
      last_mode = 'match',
      last_result = excluded.last_result,
      last_seen_at = excluded.last_seen_at,
      match_sessions_total = public.user_word_progress.match_sessions_total + 1,
      match_success_total = public.user_word_progress.match_success_total + excluded.match_success_total,
      match_errors_total = public.user_word_progress.match_errors_total + excluded.match_errors_total,
      updated_at = now();
  end loop;

  for error_row in select value from jsonb_array_elements(coalesce(payload->'errors', '[]'::jsonb)) loop
    insert into public.match_session_errors (
      session_id, user_id, word_id_a, word_id_b, error_count
    ) values (
      session_uuid, owner_id,
      least(error_row->>'word_id_a', error_row->>'word_id_b'),
      greatest(error_row->>'word_id_a', error_row->>'word_id_b'),
      greatest(1, coalesce((error_row->>'error_count')::integer, 1))
    );
  end loop;

  return jsonb_build_object('created', true, 'id', session_uuid);
end;
$$;

revoke execute on function public.save_learn_session(jsonb) from public, anon;
revoke execute on function public.save_test_session(jsonb) from public, anon;
revoke execute on function public.save_match_session(jsonb) from public, anon;
grant execute on function public.save_learn_session(jsonb) to authenticated;
grant execute on function public.save_test_session(jsonb) to authenticated;
grant execute on function public.save_match_session(jsonb) to authenticated;

-- =========================================================
-- BLOCKED EMAILS AUTH HOOK
-- =========================================================

create table if not exists public.blocked_emails (
  email text primary key,
  reason text,
  created_at timestamptz not null default now(),
  created_by text not null default 'dashboard',
  constraint blocked_emails_not_empty check (char_length(btrim(email)) > 3),
  constraint blocked_emails_normalized check (email = lower(btrim(email)))
);

alter table public.blocked_emails enable row level security;
revoke all on table public.blocked_emails from anon, authenticated;
grant select on table public.blocked_emails to supabase_auth_admin;

drop policy if exists blocked_emails_auth_hook_select on public.blocked_emails;
create policy blocked_emails_auth_hook_select on public.blocked_emails
for select to supabase_auth_admin using (true);

create or replace function public.normalize_blocked_email()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.email = lower(btrim(new.email));
  return new;
end;
$$;

drop trigger if exists blocked_emails_normalize on public.blocked_emails;
create trigger blocked_emails_normalize
before insert or update on public.blocked_emails
for each row execute function public.normalize_blocked_email();

create or replace function public.hook_reject_blocked_email(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  candidate_email text;
begin
  candidate_email := lower(btrim(coalesce(event->'user'->>'email', '')));
  if candidate_email <> '' and exists (
    select 1 from public.blocked_emails where email = candidate_email
  ) then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Вход или регистрация для этого адреса недоступны.'
      )
    );
  end if;
  return '{}'::jsonb;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_reject_blocked_email(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_reject_blocked_email(jsonb) from public, anon, authenticated;

commit;

notify pgrst, 'reload schema';

-- Block an email:
-- insert into public.blocked_emails (email, reason)
-- values ('example@gmail.com', 'Blocked by administrator')
-- on conflict (email) do update set reason = excluded.reason;
--
-- Unblock an email:
-- delete from public.blocked_emails where email = 'example@gmail.com';


-- AlanTil 13.6.1 — station path, reviews and rewards.
-- Safe to run after the 12.4 schema. Existing tables and RPC functions are not removed.

create table if not exists public.user_station_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  dictionary_id text not null,
  catalog_id text not null,
  group_id text not null,
  set_id text not null,
  story_type text not null check (char_length(btrim(story_type)) > 0),
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
  story_type text not null check (char_length(btrim(story_type)) > 0),
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

create index if not exists station_test_session_words_session_user_idx
  on public.station_test_session_words (session_id, user_id);
create index if not exists station_test_session_words_word_idx
  on public.station_test_session_words (word_id);
create index if not exists station_test_session_words_wrong_word_idx
  on public.station_test_session_words (wrong_word_id)
  where wrong_word_id is not null;

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
  selected_dictionary_id text not null default '1',
  active_story text not null default '1' check (char_length(btrim(active_story)) > 0),
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
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists station_test_sessions_own on public.station_test_sessions;
create policy station_test_sessions_own on public.station_test_sessions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists station_test_session_words_own on public.station_test_session_words;
create policy station_test_session_words_own on public.station_test_session_words
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists user_rewards_own on public.user_rewards;
create policy user_rewards_own on public.user_rewards
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists user_route_settings_own on public.user_route_settings;
create policy user_route_settings_own on public.user_route_settings
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

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
    coalesce(nullif(payload->>'story_type', ''), '1'),
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

-- =========================================================
-- ALANTIL 13.7 — CANONICAL DICTIONARY PROGRESS
-- Keep the destructive legacy cleanup in supabase/deferred until 13.7 is live.
-- =========================================================

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
-- ALANTIL 13.7 UI FOLLOW-UP — CANONICAL CYRILLIC DISPLAY VARIANT
-- Existing user choices are preserved; canonical is the default for new rows.

alter table public.user_settings
  alter column alan_dialect_code set default 'canonical';

alter table public.user_settings
  drop constraint if exists user_settings_alan_dialect_code_check;

alter table public.user_settings
  add constraint user_settings_alan_dialect_code_check
  check (alan_dialect_code in ('canonical', 'karachay', 'balkar')) not valid;

alter table public.user_settings
  validate constraint user_settings_alan_dialect_code_check;

comment on column public.user_settings.alan_dialect_code is
  'Cyrillic display variant: canonical keeps Җ, karachay renders Дж, balkar renders Ж.';

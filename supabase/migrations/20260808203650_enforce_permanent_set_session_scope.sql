begin;

create or replace function private.validate_learning_session_scope()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public', 'private'
as $$
begin
  if new.dictionary_id = '__fav__' then
    return new;
  end if;

  if not exists (
    select 1
    from public.content_words w
    where w.dictionary_id = new.dictionary_id
      and w.set_id = new.set_id
  ) then
    raise exception 'Unknown dictionary/set scope: % / %', new.dictionary_id, new.set_id;
  end if;
  return new;
end;
$$;

create or replace function private.validate_learning_session_word_scope()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public', 'private'
as $$
declare
  session_dictionary text;
  session_set text;
begin
  select s.dictionary_id, s.set_id
    into session_dictionary, session_set
  from public.learn_sessions s
  where s.id = new.session_id;

  if session_dictionary is null then
    raise exception 'Learning session % does not exist', new.session_id;
  end if;

  if session_dictionary = '__fav__' then
    if not exists (select 1 from public.content_words w where w.word_id = new.word_id) then
      raise exception 'Unknown word %', new.word_id;
    end if;
    return new;
  end if;

  if not exists (
    select 1 from public.content_words w
    where w.word_id = new.word_id
      and w.dictionary_id = session_dictionary
      and w.set_id = session_set
  ) then
    raise exception 'Word % does not belong to % / %', new.word_id, session_dictionary, session_set;
  end if;
  return new;
end;
$$;

create or replace function private.validate_station_test_session_scope()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public', 'private'
as $$
begin
  if not exists (
    select 1
    from public.content_words w
    join public.content_stories s on w.dictionary_id = any(s.dictionary_ids)
    where w.dictionary_id = new.dictionary_id
      and w.set_id = new.set_id
      and s.story_id = new.story_type
  ) then
    raise exception 'Unknown station scope: % / % / %', new.story_type, new.dictionary_id, new.set_id;
  end if;
  return new;
end;
$$;

create or replace function private.validate_station_test_word_scope()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public', 'private'
as $$
declare
  session_dictionary text;
  session_set text;
begin
  select s.dictionary_id, s.set_id
    into session_dictionary, session_set
  from public.station_test_sessions s
  where s.id = new.session_id;

  if session_dictionary is null then
    raise exception 'Station test session % does not exist', new.session_id;
  end if;

  if not exists (
    select 1 from public.content_words w
    where w.word_id = new.word_id
      and w.dictionary_id = session_dictionary
      and w.set_id = session_set
  ) then
    raise exception 'Word % does not belong to station % / %', new.word_id, session_dictionary, session_set;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_learning_session_scope on public.learn_sessions;
create trigger trg_validate_learning_session_scope
before insert on public.learn_sessions
for each row execute function private.validate_learning_session_scope();

drop trigger if exists trg_validate_learning_session_word_scope on public.learn_session_words;
create trigger trg_validate_learning_session_word_scope
before insert on public.learn_session_words
for each row execute function private.validate_learning_session_word_scope();

drop trigger if exists trg_validate_station_test_session_scope on public.station_test_sessions;
create trigger trg_validate_station_test_session_scope
before insert on public.station_test_sessions
for each row execute function private.validate_station_test_session_scope();

drop trigger if exists trg_validate_station_test_word_scope on public.station_test_session_words;
create trigger trg_validate_station_test_word_scope
before insert on public.station_test_session_words
for each row execute function private.validate_station_test_word_scope();

commit;

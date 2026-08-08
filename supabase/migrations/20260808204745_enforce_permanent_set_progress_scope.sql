begin;

create or replace function private.canonicalize_user_set_progress_scope()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public', 'private'
as $$
declare
  canonical_dictionary text;
begin
  select w.dictionary_id
    into canonical_dictionary
  from public.content_words w
  where w.set_id = new.set_id
  limit 1;

  if canonical_dictionary is null then
    raise exception 'Unknown set %', new.set_id;
  end if;

  new.dictionary_id := canonical_dictionary;
  new.section_id := canonical_dictionary;
  return new;
end;
$$;

drop trigger if exists trg_canonicalize_user_set_progress_scope on public.user_set_progress;
create trigger trg_canonicalize_user_set_progress_scope
before insert or update of dictionary_id, section_id, set_id
on public.user_set_progress
for each row execute function private.canonicalize_user_set_progress_scope();

create or replace function private.canonicalize_user_station_progress_scope()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public', 'private'
as $$
declare
  canonical_dictionary text;
  canonical_story text;
begin
  select w.dictionary_id, s.story_id
    into canonical_dictionary, canonical_story
  from public.content_words w
  join public.content_stories s on w.dictionary_id = any(s.dictionary_ids)
  where w.set_id = new.set_id
  limit 1;

  if canonical_dictionary is null or canonical_story is null then
    raise exception 'Unknown station set %', new.set_id;
  end if;

  new.dictionary_id := canonical_dictionary;
  new.catalog_id := canonical_dictionary;
  new.group_id := canonical_dictionary;
  new.story_type := canonical_story;
  return new;
end;
$$;

drop trigger if exists trg_canonicalize_user_station_progress_scope on public.user_station_progress;
create trigger trg_canonicalize_user_station_progress_scope
before insert or update of dictionary_id, catalog_id, group_id, set_id, story_type
on public.user_station_progress
for each row execute function private.canonicalize_user_station_progress_scope();

commit;

begin;

create or replace function private.validate_story_dictionary_mapping()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public', 'private'
as $$
declare
  duplicate_dictionary text;
begin
  if new.dictionary_ids is null or cardinality(new.dictionary_ids) = 0 then
    raise exception 'Story % must contain at least one dictionary', new.story_id;
  end if;

  select dictionary_id
    into duplicate_dictionary
  from unnest(new.dictionary_ids) dictionary_id
  group by dictionary_id
  having count(*) > 1
  limit 1;

  if duplicate_dictionary is not null then
    raise exception 'Dictionary % is repeated in story %', duplicate_dictionary, new.story_id;
  end if;

  select dictionary_id
    into duplicate_dictionary
  from unnest(new.dictionary_ids) dictionary_id
  where exists (
    select 1
    from public.content_stories other
    where other.story_id <> new.story_id
      and dictionary_id = any(other.dictionary_ids)
  )
  limit 1;

  if duplicate_dictionary is not null then
    raise exception 'Dictionary % already belongs to another story', duplicate_dictionary;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_story_dictionary_mapping on public.content_stories;
create trigger trg_validate_story_dictionary_mapping
before insert or update of dictionary_ids, story_id
on public.content_stories
for each row execute function private.validate_story_dictionary_mapping();

create or replace function private.protect_story_dictionary_mapping()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public', 'private'
as $$
declare
  removed_dictionary text;
begin
  select old_dictionary
    into removed_dictionary
  from unnest(old.dictionary_ids) old_dictionary
  where (tg_op = 'DELETE' or not old_dictionary = any(new.dictionary_ids))
    and exists (
      select 1 from public.content_words w where w.dictionary_id = old_dictionary
    )
  limit 1;

  if removed_dictionary is not null then
    raise exception 'Dictionary % still contains words and cannot be detached from its story', removed_dictionary;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_story_dictionary_mapping on public.content_stories;
create trigger trg_protect_story_dictionary_mapping
before delete or update of dictionary_ids
on public.content_stories
for each row execute function private.protect_story_dictionary_mapping();

create or replace function private.validate_content_word_dictionary()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public', 'private'
as $$
declare
  story_matches integer;
begin
  select count(*)::integer
    into story_matches
  from public.content_stories s
  where new.dictionary_id = any(s.dictionary_ids);

  if story_matches <> 1 then
    raise exception 'Dictionary % must belong to exactly one story', new.dictionary_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_content_word_dictionary on public.content_words;
create trigger trg_validate_content_word_dictionary
before insert or update of dictionary_id
on public.content_words
for each row execute function private.validate_content_word_dictionary();

commit;

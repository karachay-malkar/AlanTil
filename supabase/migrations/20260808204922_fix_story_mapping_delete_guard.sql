begin;

create or replace function private.protect_story_dictionary_mapping()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public', 'private'
as $$
declare
  removed_dictionary text;
begin
  if tg_op = 'DELETE' then
    select old_dictionary
      into removed_dictionary
    from unnest(old.dictionary_ids) old_dictionary
    where exists (
      select 1 from public.content_words w where w.dictionary_id = old_dictionary
    )
    limit 1;

    if removed_dictionary is not null then
      raise exception 'Dictionary % still contains words and cannot be detached from its story', removed_dictionary;
    end if;
    return old;
  end if;

  select old_dictionary
    into removed_dictionary
  from unnest(old.dictionary_ids) old_dictionary
  where not old_dictionary = any(new.dictionary_ids)
    and exists (
      select 1 from public.content_words w where w.dictionary_id = old_dictionary
    )
  limit 1;

  if removed_dictionary is not null then
    raise exception 'Dictionary % still contains words and cannot be detached from its story', removed_dictionary;
  end if;
  return new;
end;
$$;

commit;

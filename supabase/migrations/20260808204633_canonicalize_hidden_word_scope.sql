begin;

create or replace function private.canonicalize_hidden_word_scope()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public', 'private'
as $$
declare
  canonical_dictionary text;
  canonical_set text;
begin
  select w.dictionary_id, w.set_id
    into canonical_dictionary, canonical_set
  from public.content_words w
  where w.word_id = new.word_id;

  if canonical_dictionary is null or canonical_set is null then
    raise exception 'Unknown word %', new.word_id;
  end if;

  new.dictionary_id := canonical_dictionary;
  new.section_id := canonical_dictionary;
  new.set_id := canonical_set;
  return new;
end;
$$;

drop trigger if exists trg_canonicalize_hidden_word_scope on public.user_hidden_words;
create trigger trg_canonicalize_hidden_word_scope
before insert or update of word_id, dictionary_id, section_id, set_id
on public.user_hidden_words
for each row execute function private.canonicalize_hidden_word_scope();

commit;

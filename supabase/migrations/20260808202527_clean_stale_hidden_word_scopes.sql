begin;

delete from public.user_hidden_words h
where not exists (
  select 1 from public.content_words w where w.word_id = h.word_id
);

update public.user_hidden_words h
set dictionary_id = w.dictionary_id,
    section_id = w.dictionary_id,
    set_id = w.set_id,
    updated_at = now()
from public.content_words w
where w.word_id = h.word_id
  and (h.dictionary_id, h.section_id, h.set_id)
      is distinct from (w.dictionary_id, w.dictionary_id, w.set_id);

alter table public.user_hidden_words
  add constraint user_hidden_words_content_word_fk
  foreign key (word_id) references public.content_words(word_id)
  on update cascade on delete cascade not valid;

commit;

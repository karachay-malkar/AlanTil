-- Repository copy of the v_words_app migration already applied in Supabase.

begin;

create or replace view public.v_words_app
with (security_invoker = true)
as
select
  w.word_id,
  w.global_order,
  w.story_id,
  stories.name_ru as story_name_ru,
  stories.name_alan_cyrillic as story_name_alan_cyrillic,
  stories.name_alan_turkic as story_name_alan_turkic,
  w.dictionary_id,
  dictionaries.name_ru as dictionary_name_ru,
  dictionaries.name_alan_cyrillic as dictionary_name_alan_cyrillic,
  dictionaries.name_alan_turkic as dictionary_name_alan_turkic,
  w.section_id,
  sections.name_ru as section_name_ru,
  sections.name_alan_cyrillic as section_name_alan_cyrillic,
  sections.name_alan_turkic as section_name_alan_turkic,
  w.set_id,
  sets.name_ru as set_name_ru,
  sets.name_alan_cyrillic as set_name_alan_cyrillic,
  sets.name_alan_turkic as set_name_alan_turkic,
  w.pos,
  w.synonyms,
  alan_cyr.word_text as word_alan_cyrillic,
  alan_turkic.word_text as word_alan_turkic,
  russian.translation_text as translation_ru,
  alan_cyr.phrases_text as phrases_alan_cyrillic,
  alan_turkic.phrases_text as phrases_alan_turkic,
  russian.phrases_text as phrases_ru
from public.content_words as w
join public.content_stories as stories
  on stories.story_id = w.story_id
join public.content_dictionaries as dictionaries
  on dictionaries.dictionary_id = w.dictionary_id
  and dictionaries.story_id = w.story_id
join public.content_sections as sections
  on sections.section_id = w.section_id
  and sections.dictionary_id = w.dictionary_id
left join public.content_sets as sets
  on sets.id = w.set_id
  and sets.section_id = w.section_id
join public.content_word_texts as alan_cyr
  on alan_cyr.word_id = w.word_id
  and alan_cyr.language_code = 'alan'
  and alan_cyr.script_code = 'cyrillic'
left join public.content_word_texts as alan_turkic
  on alan_turkic.word_id = w.word_id
  and alan_turkic.language_code = 'alan'
  and alan_turkic.script_code = 'turkic'
join public.content_word_texts as russian
  on russian.word_id = w.word_id
  and russian.language_code = 'ru'
  and russian.script_code = '';

revoke all on public.v_words_app from public, anon, authenticated;
grant select on public.v_words_app to anon, authenticated, service_role;

comment on view public.v_words_app is
  'Canonical AlanTil word API with Cyrillic, stored Turkic and Russian text.';

commit;

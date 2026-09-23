begin;

update public.content_structure
set
  name_alan_cyrillic = 'Сют саууу',
  name_alan_turkic = 'Süt sawuu'
where entity_type = 'set'
  and entity_id = 'intermediate-24';

update public.dictionary_metadata
set current_version = '2026.09.23.3'
where dictionary_key = 'main';

commit;

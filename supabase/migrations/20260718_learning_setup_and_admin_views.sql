begin;

alter table public.user_settings
  add column if not exists learning_setup_completed_at timestamptz;

update public.user_settings
set learning_setup_completed_at = coalesce(learning_setup_completed_at, now())
where learning_setup_completed_at is null;

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
  russian.phrases_text as phrases_ru,
  stories.name_en as story_name_en,
  stories.name_tr as story_name_tr,
  dictionaries.name_en as dictionary_name_en,
  dictionaries.name_tr as dictionary_name_tr,
  sections.name_en as section_name_en,
  sections.name_tr as section_name_tr,
  sets.name_en as set_name_en,
  sets.name_tr as set_name_tr,
  english.translation_text as translation_en,
  turkish.translation_text as translation_tr,
  english.phrases_text as phrases_en,
  turkish.phrases_text as phrases_tr
from public.content_words w
join public.content_stories stories
  on stories.story_id = w.story_id
join public.content_dictionaries dictionaries
  on dictionaries.dictionary_id = w.dictionary_id
 and dictionaries.story_id = w.story_id
join public.content_sections sections
  on sections.section_id = w.section_id
 and sections.dictionary_id = w.dictionary_id
left join public.content_sets sets
  on sets.id = w.set_id
 and sets.section_id = w.section_id
join public.content_word_texts alan_cyr
  on alan_cyr.word_id = w.word_id
 and alan_cyr.language_code = 'alan'
 and alan_cyr.script_code = 'cyrillic'
left join public.content_word_texts alan_turkic
  on alan_turkic.word_id = w.word_id
 and alan_turkic.language_code = 'alan'
 and alan_turkic.script_code = 'turkic'
join public.content_word_texts russian
  on russian.word_id = w.word_id
 and russian.language_code = 'ru'
 and russian.script_code = ''
left join public.content_word_texts english
  on english.word_id = w.word_id
 and english.language_code = 'en'
 and coalesce(english.script_code, '') = ''
left join public.content_word_texts turkish
  on turkish.word_id = w.word_id
 and turkish.language_code = 'tr'
 and coalesce(turkish.script_code, '') = '';

create or replace view public.v_admin_users
with (security_invoker = true)
as
select
  u.id as user_id,
  coalesce(nullif(p.nickname, ''), nullif(u.raw_user_meta_data ->> 'full_name', ''), nullif(u.raw_user_meta_data ->> 'name', '')) as nickname,
  u.email,
  p.avatar_gender,
  u.created_at as registered_at,
  u.last_sign_in_at
from auth.users u
left join public.profiles p on p.user_id = u.id;

create or replace view public.v_admin_sessions
with (security_invoker = true)
as
select
  'learn'::text as session_type,
  s.id as session_id,
  s.user_id,
  u.nickname,
  u.email,
  s.started_at,
  s.ended_at,
  s.status,
  s.duration_sec
from public.learn_sessions s
left join public.v_admin_users u on u.user_id = s.user_id
union all
select
  'test'::text,
  s.id,
  s.user_id,
  u.nickname,
  u.email,
  s.started_at,
  s.ended_at,
  s.status,
  s.duration_sec
from public.test_sessions s
left join public.v_admin_users u on u.user_id = s.user_id
union all
select
  'match'::text,
  s.id,
  s.user_id,
  u.nickname,
  u.email,
  s.started_at,
  s.ended_at,
  s.status,
  s.duration_sec
from public.match_sessions s
left join public.v_admin_users u on u.user_id = s.user_id
union all
select
  'station_test'::text,
  s.id,
  s.user_id,
  u.nickname,
  u.email,
  s.started_at,
  s.ended_at,
  s.status,
  s.duration_sec
from public.station_test_sessions s
left join public.v_admin_users u on u.user_id = s.user_id;

revoke all on public.v_admin_users from public, anon, authenticated;
revoke all on public.v_admin_sessions from public, anon, authenticated;
revoke all on public.v_admin_users from service_role;
revoke all on public.v_admin_sessions from service_role;
grant select on public.v_admin_users to service_role;
grant select on public.v_admin_sessions to service_role;

comment on view public.v_admin_users is 'Administrative user directory with nickname and auth email. Not exposed to client roles.';
comment on view public.v_admin_sessions is 'Administrative session feed with user nickname and auth email. Not exposed to client roles.';

update public.dictionary_metadata
set current_version = '18.07.2026'
where dictionary_key = 'main';

commit;

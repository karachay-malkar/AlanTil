begin;

create table public.content_stories_next (
  story_id text primary key,
  story_order integer not null unique,
  dictionary_ids text[] not null,
  name_alan_cyrillic text,
  name_alan_turkic text,
  name_ru text not null,
  name_en text,
  name_tr text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_stories_next_dictionary_ids_check check (cardinality(dictionary_ids) > 0)
);

insert into public.content_stories_next (
  story_id, story_order, dictionary_ids,
  name_alan_cyrillic, name_alan_turkic, name_ru, name_en, name_tr,
  created_at, updated_at
)
select
  case story_id
    when 1 then 'roots'
    when 2 then 'ascent'
    when 3 then 'pathways'
  end,
  story_id::integer,
  case story_id
    when 1 then array['beginner','intermediate']::text[]
    when 2 then array['advanced']::text[]
    when 3 then array['universe','animals','natural_materials','plants']::text[]
  end,
  name_alan_cyrillic,
  name_alan_turkic,
  name_ru,
  name_en,
  name_tr,
  created_at,
  updated_at
from public.content_stories
where story_id in (1,2,3)
order by story_id;

create table public.content_words_next (
  word_id text primary key,
  global_order integer not null unique,
  dictionary_id text not null,
  set_id text not null,
  pos text,
  synonyms text,
  word_alan_cyrillic text not null,
  word_alan_turkic text not null,
  translation_ru text not null,
  translation_en text not null,
  translation_tr text not null,
  phrases_alan_cyrillic text,
  phrases_alan_turkic text,
  phrases_ru text,
  phrases_en text,
  phrases_tr text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_words_next_set_format_check check (
    set_id ~ '^[a-z][a-z0-9_]*-[0-9]{2,}$'
    and set_id like dictionary_id || '-%'
  )
);

create index content_words_next_dictionary_set_order_idx
  on public.content_words_next (dictionary_id, set_id, global_order);

with source as (
  select
    v.*,
    cw.created_at,
    cw.updated_at,
    row_number() over (partition by v.section_id order by v.global_order) as dictionary_position,
    dense_rank() over (partition by v.section_id order by v.set_id) as legacy_set_position
  from public.v_words_app v
  join public.content_words cw using (word_id)
), mapped as (
  select
    source.*,
    case section_id
      when 1 then 'beginner'
      when 2 then 'intermediate'
      when 3 then 'advanced'
      when 4 then 'universe'
      when 5 then 'animals'
      when 6 then 'natural_materials'
      when 7 then 'plants'
    end as new_dictionary_id,
    case
      when section_id in (1,2,3) then ceil(dictionary_position / 30.0)::integer
      else legacy_set_position::integer
    end as new_set_number
  from source
)
insert into public.content_words_next (
  word_id, global_order, dictionary_id, set_id, pos, synonyms,
  word_alan_cyrillic, word_alan_turkic,
  translation_ru, translation_en, translation_tr,
  phrases_alan_cyrillic, phrases_alan_turkic,
  phrases_ru, phrases_en, phrases_tr,
  created_at, updated_at
)
select
  word_id,
  global_order,
  new_dictionary_id,
  new_dictionary_id || '-' || lpad(new_set_number::text, 2, '0'),
  pos,
  synonyms,
  word_alan_cyrillic,
  word_alan_turkic,
  translation_ru,
  translation_en,
  translation_tr,
  phrases_alan_cyrillic,
  phrases_alan_turkic,
  phrases_ru,
  phrases_en,
  phrases_tr,
  created_at,
  updated_at
from mapped
order by global_order;

do $$
begin
  if (select count(*) from public.content_words_next) <> (select count(*) from public.content_words) then
    raise exception 'Flat word migration count mismatch';
  end if;

  if exists (
    select 1
    from public.v_words_app old
    join public.content_words_next new using (word_id)
    where old.global_order is distinct from new.global_order
       or old.pos is distinct from new.pos
       or old.synonyms is distinct from new.synonyms
       or old.word_alan_cyrillic is distinct from new.word_alan_cyrillic
       or old.word_alan_turkic is distinct from new.word_alan_turkic
       or old.translation_ru is distinct from new.translation_ru
       or old.translation_en is distinct from new.translation_en
       or old.translation_tr is distinct from new.translation_tr
       or old.phrases_alan_cyrillic is distinct from new.phrases_alan_cyrillic
       or old.phrases_alan_turkic is distinct from new.phrases_alan_turkic
       or old.phrases_ru is distinct from new.phrases_ru
       or old.phrases_en is distinct from new.phrases_en
       or old.phrases_tr is distinct from new.phrases_tr
  ) then
    raise exception 'Flat word migration changed lexical content';
  end if;

  if (select count(distinct set_id) from public.content_words_next) <> 85 then
    raise exception 'Expected 85 permanent sets';
  end if;

  if exists (
    select 1
    from public.content_words_next
    where dictionary_id in ('beginner','intermediate','advanced')
    group by set_id
    having count(*) > 30
  ) then
    raise exception 'A level set exceeds 30 words';
  end if;
end $$;

with ranked as (
  select ctid,
         row_number() over (
           partition by user_id, word_id
           order by updated_at desc, is_hidden desc, set_id desc
         ) as rn
  from public.user_hidden_words
)
delete from public.user_hidden_words target
using ranked
where target.ctid = ranked.ctid
  and ranked.rn > 1;

update public.user_hidden_words h
set dictionary_id = w.dictionary_id,
    section_id = w.dictionary_id,
    set_id = w.set_id,
    updated_at = greatest(h.updated_at, now())
from public.content_words_next w
where w.word_id = h.word_id;

update public.user_route_settings
set active_story = case active_story
  when '1' then 'roots'
  when '2' then 'ascent'
  when '3' then 'pathways'
  else active_story
end,
updated_at = now()
where active_story in ('1','2','3');

with session_story as (
  select stw.session_id, min(cw.story_id) as story_id
  from public.station_test_session_words stw
  join public.content_words cw on cw.word_id = stw.word_id
  group by stw.session_id
  having count(distinct cw.story_id) = 1
)
update public.station_test_sessions s
set story_type = case ss.story_id
  when 1 then 'roots'
  when 2 then 'ascent'
  when 3 then 'pathways'
  else s.story_type
end
from session_story ss
where ss.session_id = s.id;

alter table public.station_test_session_words drop constraint if exists station_test_session_words_word_id_fkey;
alter table public.station_test_session_words drop constraint if exists station_test_session_words_wrong_word_id_fkey;
alter table public.user_word_favorites drop constraint if exists user_word_favorites_content_word_fk;
alter table public.user_word_progress drop constraint if exists user_word_progress_word_fk;

drop view if exists public.content_words_ru;
drop view if exists public.v_words_app;
drop table public.content_word_texts;
drop function if exists private.sync_alan_turkic_word_text();
drop table public.content_words;
drop table public.content_sets;
drop table public.content_sections;
drop table public.content_dictionaries;
drop table public.content_stories;

alter table public.content_stories_next rename to content_stories;
alter table public.content_words_next rename to content_words;
alter index public.content_words_next_dictionary_set_order_idx rename to content_words_dictionary_set_order_idx;

alter table public.content_stories rename constraint content_stories_next_dictionary_ids_check to content_stories_dictionary_ids_check;
alter table public.content_words rename constraint content_words_next_set_format_check to content_words_set_format_check;

alter table public.station_test_session_words
  add constraint station_test_session_words_word_id_fkey
  foreign key (word_id) references public.content_words(word_id);
alter table public.station_test_session_words
  add constraint station_test_session_words_wrong_word_id_fkey
  foreign key (wrong_word_id) references public.content_words(word_id);
alter table public.user_word_favorites
  add constraint user_word_favorites_content_word_fk
  foreign key (word_id) references public.content_words(word_id)
  on update cascade on delete restrict not valid;
alter table public.user_word_progress
  add constraint user_word_progress_word_fk
  foreign key (word_id) references public.content_words(word_id)
  on update cascade on delete restrict not valid;

alter table public.content_words enable row level security;
alter table public.content_stories enable row level security;
create policy content_words_public_read on public.content_words
  for select to anon, authenticated using (true);
create policy content_stories_public_read on public.content_stories
  for select to anon, authenticated using (true);
grant select on public.content_words to anon, authenticated;
grant select on public.content_stories to anon, authenticated;

create view public.v_words_app
with (security_invoker = true)
as
select
  w.word_id,
  w.global_order,
  s.story_id,
  s.name_ru as story_name_ru,
  s.name_alan_cyrillic as story_name_alan_cyrillic,
  s.name_alan_turkic as story_name_alan_turkic,
  w.dictionary_id,
  w.dictionary_id as dictionary_name_ru,
  w.dictionary_id as dictionary_name_alan_cyrillic,
  w.dictionary_id as dictionary_name_alan_turkic,
  w.dictionary_id as section_id,
  w.dictionary_id as section_name_ru,
  w.dictionary_id as section_name_alan_cyrillic,
  w.dictionary_id as section_name_alan_turkic,
  w.set_id,
  w.set_id as set_name_ru,
  w.set_id as set_name_alan_cyrillic,
  w.set_id as set_name_alan_turkic,
  w.pos,
  w.synonyms,
  w.word_alan_cyrillic,
  w.word_alan_turkic,
  w.translation_ru,
  w.phrases_alan_cyrillic,
  w.phrases_alan_turkic,
  w.phrases_ru,
  s.name_en as story_name_en,
  s.name_tr as story_name_tr,
  w.dictionary_id as dictionary_name_en,
  w.dictionary_id as dictionary_name_tr,
  w.dictionary_id as section_name_en,
  w.dictionary_id as section_name_tr,
  w.set_id as set_name_en,
  w.set_id as set_name_tr,
  w.translation_en,
  w.translation_tr,
  w.phrases_en,
  w.phrases_tr
from public.content_words w
join public.content_stories s
  on w.dictionary_id = any(s.dictionary_ids);

grant select on public.v_words_app to anon, authenticated;

create or replace function private.sync_alan_turkic_word_text()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public', 'private'
as $$
begin
  if tg_op = 'INSERT' then
    if new.word_alan_turkic is null or btrim(new.word_alan_turkic) = '' then
      new.word_alan_turkic := private.alan_to_turkic(new.word_alan_cyrillic);
    end if;
    if new.phrases_alan_turkic is null and new.phrases_alan_cyrillic is not null then
      new.phrases_alan_turkic := private.alan_to_turkic(new.phrases_alan_cyrillic);
    end if;
  else
    if new.word_alan_cyrillic is distinct from old.word_alan_cyrillic then
      new.word_alan_turkic := private.alan_to_turkic(new.word_alan_cyrillic);
    end if;
    if new.phrases_alan_cyrillic is distinct from old.phrases_alan_cyrillic then
      new.phrases_alan_turkic := case
        when new.phrases_alan_cyrillic is null then null
        else private.alan_to_turkic(new.phrases_alan_cyrillic)
      end;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_sync_alan_turkic_word_text
before insert or update of word_alan_cyrillic, phrases_alan_cyrillic
on public.content_words
for each row execute function private.sync_alan_turkic_word_text();

alter table public.user_settings drop constraint if exists user_settings_station_size_check;
alter table public.user_settings drop column if exists station_size;

update public.dictionary_metadata
set current_version = '13.12.0'
where dictionary_key = 'main';

commit;

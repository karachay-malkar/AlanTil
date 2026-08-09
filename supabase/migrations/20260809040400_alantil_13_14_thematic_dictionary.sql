begin;

update public.content_structure set name_ru='Вводный',name_en='Starter',name_tr='Başlangıç',name_alan_cyrillic='Башланыу',name_alan_turkic='Başlanıw' where entity_id='beginner-starter' and entity_type='section';
update public.content_structure set name_ru='Базовый',name_en='Elementary',name_tr='Temel',name_alan_cyrillic='Тамал',name_alan_turkic='Tamal' where entity_id='beginner-elementary' and entity_type='section';
update public.content_structure set name_ru='Средний',name_en='Intermediate',name_tr='Orta',name_alan_cyrillic='Орта',name_alan_turkic='Orta' where entity_id='intermediate-intermediate' and entity_type='section';
update public.content_structure set name_ru='Выше среднего',name_en='Upper-Intermediate',name_tr='Orta Üstü',name_alan_cyrillic='Ортадан ёрге',name_alan_turkic='Ortadan örge' where entity_id='intermediate-upper-intermediate' and entity_type='section';
update public.content_structure set name_ru='Продвинутый',name_en='Advanced',name_tr='İleri',name_alan_cyrillic='Къыйын дараҗа',name_alan_turkic='Qıyın daraca' where entity_id='advanced-advanced' and entity_type='section';
update public.content_structure set name_ru='Мастер',name_en='Proficiency',name_tr='Usta',name_alan_cyrillic='Уста',name_alan_turkic='Usta' where entity_id='advanced-proficiency' and entity_type='section';

-- Preserve all permanent set IDs; move the old thematic Section names onto them.
update public.content_structure set_node
set name_alan_cyrillic=topic.name_alan_cyrillic,name_alan_turkic=topic.name_alan_turkic,name_ru=topic.name_ru,name_en=topic.name_en,name_tr=topic.name_tr
from public.content_structure topic
where set_node.entity_type='set' and topic.entity_type='section' and set_node.parent_id=topic.entity_id and topic.parent_id in ('universe','animals','natural_materials','plants');

insert into public.content_structure(entity_id,entity_type,parent_id,display_order,name_alan_cyrillic,name_alan_turkic,name_ru,name_en,name_tr)
values('thematic','dictionary','pathways',5,'Темалы сёзле','Temalı sözle','Тематические слова','Thematic Words','Tematik Kelimeler');

-- The four former thematic dictionaries become the four Sections of one dictionary.
update public.content_structure
set entity_type='section',parent_id='thematic',display_order=case entity_id when 'universe' then 1 when 'animals' then 2 when 'natural_materials' then 3 when 'plants' then 4 end
where entity_id in ('universe','animals','natural_materials','plants') and entity_type='dictionary';

-- Avoid a transient parent/order collision while the Set rows are re-parented.
update public.content_structure
set display_order=display_order+100
where entity_type='section' and entity_id not in ('universe','animals','natural_materials','plants') and parent_id in ('universe','animals','natural_materials','plants');

update public.content_structure set_node
set parent_id=topic.parent_id
from public.content_structure topic
where set_node.entity_type='set' and topic.entity_type='section' and set_node.parent_id=topic.entity_id
  and topic.parent_id in ('universe','animals','natural_materials','plants') and topic.entity_id not in ('universe','animals','natural_materials','plants');

-- 13.12 required set_id to begin with dictionary_id. 13.14 intentionally keeps
-- universe-01 / animals-01 / ... as permanent IDs inside dictionary thematic.
alter table public.content_words drop constraint content_words_set_format_check;

update public.content_words w
set dictionary_id='thematic',section_id=set_node.parent_id
from public.content_structure set_node
where set_node.entity_id=w.set_id and set_node.entity_type='set' and set_node.parent_id in ('universe','animals','natural_materials','plants')
  and (w.dictionary_id is distinct from 'thematic' or w.section_id is distinct from set_node.parent_id);

alter table public.content_words add constraint content_words_set_format_check check (
  set_id ~ '^[a-z][a-z0-9_]*-[0-9]{2,}$'
  and (
    (dictionary_id in ('beginner','intermediate','advanced') and set_id like dictionary_id || '-%')
    or
    (dictionary_id='thematic' and set_id ~ '^(universe|animals|natural_materials|plants)-[0-9]{2,}$')
  )
);

-- Canonicalize mutable current state only. Historical completed sessions remain historical.
update public.user_hidden_words h
set dictionary_id=w.dictionary_id,section_id=w.section_id,set_id=w.set_id
from public.content_words w
where w.word_id=h.word_id and (h.dictionary_id is distinct from w.dictionary_id or h.section_id is distinct from w.section_id or h.set_id is distinct from w.set_id);

update public.user_set_progress p
set dictionary_id=scope.dictionary_id,section_id=scope.section_id
from (select set_id,min(dictionary_id) dictionary_id,min(section_id) section_id from public.content_words group by set_id) scope
where scope.set_id=p.set_id and (p.dictionary_id is distinct from scope.dictionary_id or p.section_id is distinct from scope.section_id);

update public.user_station_progress p
set dictionary_id=scope.dictionary_id,catalog_id=scope.dictionary_id,group_id=scope.section_id,story_type=scope.story_id
from (
  select w.set_id,min(w.dictionary_id) dictionary_id,min(w.section_id) section_id,min(story.entity_id) story_id
  from public.content_words w
  join public.content_structure dict on dict.entity_id=w.dictionary_id and dict.entity_type='dictionary'
  join public.content_structure story on story.entity_id=dict.parent_id and story.entity_type='story'
  group by w.set_id
) scope
where scope.set_id=p.set_id and (p.dictionary_id is distinct from scope.dictionary_id or p.catalog_id is distinct from scope.dictionary_id or p.group_id is distinct from scope.section_id or p.story_type is distinct from scope.story_id);

delete from public.content_structure
where entity_type='section' and entity_id not in ('universe','animals','natural_materials','plants') and parent_id in ('universe','animals','natural_materials','plants');

update public.content_structure set display_order=1 where entity_id='thematic' and entity_type='dictionary';
update public.dictionary_metadata set current_version='13.14.0' where dictionary_key='main';

do $$
declare word_count integer;story_count integer;dictionary_count integer;section_count integer;set_count integer;invalid_words integer;thematic_words integer;
begin
  select count(*) into word_count from public.content_words;
  select count(*) into story_count from public.content_structure where entity_type='story';
  select count(*) into dictionary_count from public.content_structure where entity_type='dictionary';
  select count(*) into section_count from public.content_structure where entity_type='section';
  select count(*) into set_count from public.content_structure where entity_type='set';
  select count(*) into thematic_words from public.content_words where dictionary_id='thematic';
  select count(*) into invalid_words
  from public.content_words w
  left join public.content_structure set_node on set_node.entity_id=w.set_id and set_node.entity_type='set'
  left join public.content_structure sec on sec.entity_id=w.section_id and sec.entity_type='section' and set_node.parent_id=sec.entity_id
  left join public.content_structure dict on dict.entity_id=w.dictionary_id and dict.entity_type='dictionary' and sec.parent_id=dict.entity_id
  left join public.content_structure story on story.entity_id=dict.parent_id and story.entity_type='story'
  where set_node.entity_id is null or sec.entity_id is null or dict.entity_id is null or story.entity_id is null;
  if word_count<>2355 then raise exception 'Expected 2355 words, got %',word_count; end if;
  if story_count<>4 then raise exception 'Expected 4 stories, got %',story_count; end if;
  if dictionary_count<>4 then raise exception 'Expected 4 dictionaries, got %',dictionary_count; end if;
  if section_count<>10 then raise exception 'Expected 10 sections, got %',section_count; end if;
  if set_count<>85 then raise exception 'Expected 85 sets, got %',set_count; end if;
  if thematic_words<>596 then raise exception 'Expected 596 thematic words, got %',thematic_words; end if;
  if invalid_words<>0 then raise exception 'Hierarchy validation failed for % words',invalid_words; end if;
end $$;

commit;

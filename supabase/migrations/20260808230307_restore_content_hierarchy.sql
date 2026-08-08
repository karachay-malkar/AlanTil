begin;

create table public.content_structure (
  entity_id text primary key,
  entity_type text not null check (entity_type in ('story','dictionary','section','set')),
  parent_id text references public.content_structure(entity_id) on update cascade on delete restrict,
  display_order integer not null check (display_order > 0),
  name_alan_cyrillic text,
  name_alan_turkic text,
  name_ru text,
  name_en text,
  name_tr text,
  intro_alan_cyrillic text,
  intro_alan_turkic text,
  intro_ru text,
  intro_en text,
  intro_tr text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index content_structure_story_order_uq
  on public.content_structure(display_order)
  where entity_type = 'story';
create unique index content_structure_parent_order_uq
  on public.content_structure(parent_id, display_order)
  where parent_id is not null;
create index content_structure_parent_idx
  on public.content_structure(parent_id, entity_type, display_order);

create or replace function private.validate_content_structure_parent()
returns trigger
language plpgsql
set search_path to 'pg_catalog','public','private'
as $$
declare
  parent_type text;
  expected_parent text;
begin
  if new.entity_type = 'story' then
    if new.parent_id is not null then
      raise exception 'Story % cannot have a parent', new.entity_id;
    end if;
    return new;
  end if;

  if new.parent_id is null then
    raise exception '% % must have a parent', new.entity_type, new.entity_id;
  end if;

  expected_parent := case new.entity_type
    when 'dictionary' then 'story'
    when 'section' then 'dictionary'
    when 'set' then 'section'
  end;

  select entity_type into parent_type
  from public.content_structure
  where entity_id = new.parent_id;

  if parent_type is null then
    raise exception 'Parent % does not exist', new.parent_id;
  end if;
  if parent_type <> expected_parent then
    raise exception '% % must belong to %, got %', new.entity_type, new.entity_id, expected_parent, parent_type;
  end if;
  return new;
end;
$$;

create trigger trg_validate_content_structure_parent
before insert or update of entity_id, entity_type, parent_id
on public.content_structure
for each row execute function private.validate_content_structure_parent();

create trigger trg_content_structure_updated_at
before update on public.content_structure
for each row execute function public.set_updated_at();

insert into public.content_structure (
  entity_id, entity_type, parent_id, display_order,
  name_alan_cyrillic, name_alan_turkic, name_ru, name_en, name_tr,
  intro_alan_cyrillic, intro_alan_turkic, intro_ru, intro_en, intro_tr
) values (
  'oblivion','story',null,1,
  null,null,'На пороге забвения',null,null,
  null,null,'Это история о последних мгновениях жизни языка. Она написана скупо — простыми словами и примитивными понятиями, до которых беднеет некогда богатая речь, прежде чем умолкнуть навсегда. Это её последнее дыхание. Дальше — только забвение.',null,null
);

insert into public.content_structure (
  entity_id, entity_type, parent_id, display_order,
  name_alan_cyrillic, name_alan_turkic, name_ru, name_en, name_tr,
  created_at, updated_at
)
select story_id, 'story', null,
  case story_id when 'roots' then 2 when 'ascent' then 3 when 'pathways' then 4 end,
  name_alan_cyrillic, name_alan_turkic, name_ru, name_en, name_tr,
  created_at, updated_at
from public.content_stories
where story_id in ('roots','ascent','pathways');

insert into public.content_structure (
  entity_id, entity_type, parent_id, display_order,
  name_alan_cyrillic, name_alan_turkic, name_ru, name_en, name_tr
) values
  ('beginner','dictionary','oblivion',1,'Тынч','Tınç','Начальный','Beginner','Başlangıç'),
  ('intermediate','dictionary','roots',1,'Орта','Orta','Средний','Intermediate','Orta'),
  ('advanced','dictionary','ascent',1,'Къыйын дараҗа','Qıyın daraca','Продвинутый','Advanced','İleri Seviye'),
  ('universe','dictionary','pathways',1,'Алам','Alam','Вселенная','Universe','Evren'),
  ('animals','dictionary','pathways',2,'Җаныуарла','Canıwarla','Животные','Animals','Hayvanlar'),
  ('natural_materials','dictionary','pathways',3,'Табийгъат материалла','Tabiyğat materialla','Природные материалы','Natural Materials','Doğal Malzemeler'),
  ('plants','dictionary','pathways',4,'Гяхинле','Gyaxinle','Растения','Plants','Bitkiler');

insert into public.content_structure (
  entity_id, entity_type, parent_id, display_order,
  name_alan_cyrillic, name_alan_turkic, name_ru, name_en, name_tr
) values
  ('beginner-starter','section','beginner',1,null,null,'Starter','Starter','Starter'),
  ('beginner-elementary','section','beginner',2,null,null,'Elementary','Elementary','Elementary'),
  ('intermediate-intermediate','section','intermediate',1,null,null,'Intermediate','Intermediate','Intermediate'),
  ('intermediate-upper-intermediate','section','intermediate',2,null,null,'Upper-Intermediate','Upper-Intermediate','Upper-Intermediate'),
  ('advanced-advanced','section','advanced',1,null,null,'Advanced','Advanced','Advanced'),
  ('advanced-proficiency','section','advanced',2,null,null,'Proficiency','Proficiency','Proficiency'),
  ('universe-seasons','section','universe',1,'Җылны кезиулери','Cılnı keziwleri','Времена года','Seasons','Mevsimler'),
  ('universe-months','section','universe',2,'Җылны айлары','Cılnı ayları','Месяцы года','Months of the Year','Yılın Ayları'),
  ('universe-weekdays','section','universe',3,'Ыйыкъны кюнлери','Iyıqnı künleri','Дни недели','Days of the Week','Haftanın Günleri'),
  ('universe-space','section','universe',4,'Космос','Kosmos','Космос','Space','Uzay'),
  ('universe-colours','section','universe',5,'Тюрсюнле','Türsünle','Цвета','Colours','Renkler'),
  ('animals-aquatic-fauna','section','animals',1,'Суу жаныуарла','Suw canıwarla','Водная фауна','Aquatic Fauna','Su Faunası'),
  ('animals-omnivores-herbivores-rodents','section','animals',2,'Бютеу ашаучу, от ашаучу, кемириучю жаныуарла','Bütew aşawçu, ot aşawçu, kemiriwçü canıwarla','Всеядные, травоядные и грызуны','Omnivores, Herbivores and Rodents','Hepçiller, Otçullar ve Kemirgenler'),
  ('animals-domestic','section','animals',3,'Юй жаныуарла','Üy canıwarla','Домашние животные','Domestic Animals','Evcil Hayvanlar'),
  ('animals-amphibians-reptiles','section','animals',4,'Амфибияла, рептилияла','Amfibiyala, reptiliyala','Земноводные и рептилии','Amphibians and Reptiles','İki Yaşamlılar ve Sürüngenler'),
  ('animals-spiders-worms-insects','section','animals',5,'Гыбыла, къуртла, къумурсхала','Gıbıla, qurtla, qumursxala','Пауки, черви и насекомые','Spiders, Worms and Insects','Örümcekler, Solucanlar ve Böcekler'),
  ('animals-primates-marsupials','section','animals',6,'Приматла, къапчыкълы жаныуарла','Primatla, qapçıqlı canıwarla','Приматы и сумчатые','Primates and Marsupials','Primatlar ve Keseliler'),
  ('animals-birds','section','animals',7,'Чыпчыкъла','Çıpçıqla','Птицы','Birds','Kuşlar'),
  ('animals-predators-mammals','section','animals',8,'Жыртхычла, эмчекли жаныуарла','Cırtxıçla, emçekli canıwarla','Хищники и млекопитающие','Predators and Mammals','Yırtıcılar ve Memeliler'),
  ('natural-materials-rocks','section','natural_materials',1,'Таш породала','Taş porodala','Горные породы','Rocks','Kayaçlar'),
  ('natural-materials-metals','section','natural_materials',2,'Магъаданла','Mağadanla','Металлы','Metals','Metaller'),
  ('natural-materials-minerals','section','natural_materials',3,'Минералла','Mineralla','Минералы','Minerals','Mineraller'),
  ('natural-materials-non-metals','section','natural_materials',4,'Металл болмагъанла','Metall bolmağanla','Неметаллы','Non-metals','Ametaller'),
  ('natural-materials-other','section','natural_materials',5,'Башха материалла','Başxa materialla','Другие материалы','Other Materials','Diğer Malzemeler'),
  ('plants-trees','section','plants',1,'Терекле','Terekle','Деревья','Trees','Ağaçlar'),
  ('plants-nuts-grains-legumes','section','plants',2,'Жауузла, мирзеуле, бурчакъла','Cawuzla, mirzewle, burçaqla','Орехи, злаки и бобовые','Nuts, Grains and Legumes','Kuruyemişler, Tahıllar ve Baklagiller'),
  ('plants-other','section','plants',3,'Башха гяхинле','Başxa gyaxinle','Другие растения','Other Plants','Diğer Bitkiler'),
  ('plants-spices-herbs','section','plants',4,'Татымла, кырдыкъла','Tatımla, kırdıkla','Специи и зелень','Spices and Herbs','Baharatlar ve Yeşillikler'),
  ('plants-fruit-vegetables','section','plants',5,'Жемишле, овощла','Cemişle, ovoşla','Фрукты, овощи','Fruit and Vegetables','Meyveler ve Sebzeler'),
  ('plants-flowers','section','plants',6,'Гюлле','Gülle','Цветы','Flowers','Çiçekler'),
  ('plants-berries-shrubs','section','plants',7,'Жилекле бла чырпыла','Cilekle bla çırpıla','Ягоды и кустарники','Berries and Shrubs','Meyveler ve Çalılar');

alter table public.content_words add column section_id text;

update public.content_words
set section_id = case
  when dictionary_id = 'beginner' and substring(set_id from '([0-9]+)$')::integer <= 15 then 'beginner-starter'
  when dictionary_id = 'beginner' then 'beginner-elementary'
  when dictionary_id = 'intermediate' and substring(set_id from '([0-9]+)$')::integer <= 6 then 'intermediate-intermediate'
  when dictionary_id = 'intermediate' then 'intermediate-upper-intermediate'
  when dictionary_id = 'advanced' and substring(set_id from '([0-9]+)$')::integer <= 10 then 'advanced-advanced'
  when dictionary_id = 'advanced' then 'advanced-proficiency'
  when set_id = 'universe-01' then 'universe-seasons'
  when set_id = 'universe-02' then 'universe-months'
  when set_id = 'universe-03' then 'universe-weekdays'
  when set_id = 'universe-04' then 'universe-space'
  when set_id = 'universe-05' then 'universe-colours'
  when set_id = 'animals-01' then 'animals-aquatic-fauna'
  when set_id = 'animals-02' then 'animals-omnivores-herbivores-rodents'
  when set_id = 'animals-03' then 'animals-domestic'
  when set_id = 'animals-04' then 'animals-amphibians-reptiles'
  when set_id = 'animals-05' then 'animals-spiders-worms-insects'
  when set_id = 'animals-06' then 'animals-primates-marsupials'
  when set_id = 'animals-07' then 'animals-birds'
  when set_id = 'animals-08' then 'animals-predators-mammals'
  when set_id = 'natural_materials-01' then 'natural-materials-rocks'
  when set_id = 'natural_materials-02' then 'natural-materials-metals'
  when set_id = 'natural_materials-03' then 'natural-materials-minerals'
  when set_id = 'natural_materials-04' then 'natural-materials-non-metals'
  when set_id = 'natural_materials-05' then 'natural-materials-other'
  when set_id = 'plants-01' then 'plants-trees'
  when set_id = 'plants-02' then 'plants-nuts-grains-legumes'
  when set_id = 'plants-03' then 'plants-other'
  when set_id = 'plants-04' then 'plants-spices-herbs'
  when set_id = 'plants-05' then 'plants-fruit-vegetables'
  when set_id = 'plants-06' then 'plants-flowers'
  when set_id = 'plants-07' then 'plants-berries-shrubs'
end;

alter table public.content_words alter column section_id set not null;

insert into public.content_structure (
  entity_id, entity_type, parent_id, display_order,
  name_alan_cyrillic, name_alan_turkic, name_ru, name_en, name_tr
)
select set_id, 'set', section_id,
       substring(set_id from '([0-9]+)$')::integer,
       null, null, null, null, null
from public.content_words
group by set_id, section_id;

alter table public.content_words
  add constraint content_words_dictionary_structure_fk foreign key (dictionary_id) references public.content_structure(entity_id) on update cascade on delete restrict,
  add constraint content_words_section_structure_fk foreign key (section_id) references public.content_structure(entity_id) on update cascade on delete restrict,
  add constraint content_words_set_structure_fk foreign key (set_id) references public.content_structure(entity_id) on update cascade on delete restrict;

create index content_words_dictionary_section_set_order_idx
  on public.content_words(dictionary_id, section_id, set_id, global_order);

create or replace function private.validate_content_word_structure()
returns trigger
language plpgsql
set search_path to 'pg_catalog','public','private'
as $$
declare
  expected_section text;
  expected_dictionary text;
begin
  select sec.entity_id, dict.entity_id
    into expected_section, expected_dictionary
  from public.content_structure set_node
  join public.content_structure sec
    on sec.entity_id = set_node.parent_id and sec.entity_type = 'section'
  join public.content_structure dict
    on dict.entity_id = sec.parent_id and dict.entity_type = 'dictionary'
  where set_node.entity_id = new.set_id and set_node.entity_type = 'set';

  if expected_section is null or expected_dictionary is null then
    raise exception 'Unknown structural set %', new.set_id;
  end if;
  if new.section_id <> expected_section or new.dictionary_id <> expected_dictionary then
    raise exception 'Invalid word hierarchy for %: % / % / %', new.word_id, new.dictionary_id, new.section_id, new.set_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_content_word_dictionary on public.content_words;
create trigger trg_validate_content_word_structure
before insert or update of dictionary_id, section_id, set_id
on public.content_words
for each row execute function private.validate_content_word_structure();

drop view if exists public.v_words_app;
drop table public.content_stories;

drop function if exists private.validate_story_dictionary_mapping();
drop function if exists private.protect_story_dictionary_mapping();
drop function if exists private.validate_content_word_dictionary();

create view public.content_stories
with (security_invoker = true)
as
select
  story.entity_id as story_id,
  story.display_order as story_order,
  coalesce((
    select array_agg(dict.entity_id order by dict.display_order)
    from public.content_structure dict
    where dict.entity_type = 'dictionary' and dict.parent_id = story.entity_id
  ), array[]::text[]) as dictionary_ids,
  story.name_alan_cyrillic,
  story.name_alan_turkic,
  story.name_ru,
  story.name_en,
  story.name_tr,
  story.intro_alan_cyrillic,
  story.intro_alan_turkic,
  story.intro_ru,
  story.intro_en,
  story.intro_tr,
  story.created_at,
  story.updated_at
from public.content_structure story
where story.entity_type = 'story';

create view public.v_words_app
with (security_invoker = true)
as
select
  w.word_id,
  w.global_order,
  story.entity_id as story_id,
  story.name_ru as story_name_ru,
  story.name_alan_cyrillic as story_name_alan_cyrillic,
  story.name_alan_turkic as story_name_alan_turkic,
  w.dictionary_id,
  dict.name_ru as dictionary_name_ru,
  dict.name_alan_cyrillic as dictionary_name_alan_cyrillic,
  dict.name_alan_turkic as dictionary_name_alan_turkic,
  w.section_id,
  sec.name_ru as section_name_ru,
  sec.name_alan_cyrillic as section_name_alan_cyrillic,
  sec.name_alan_turkic as section_name_alan_turkic,
  w.set_id,
  set_node.name_ru as set_name_ru,
  set_node.name_alan_cyrillic as set_name_alan_cyrillic,
  set_node.name_alan_turkic as set_name_alan_turkic,
  w.pos,
  w.synonyms,
  w.word_alan_cyrillic,
  w.word_alan_turkic,
  w.translation_ru,
  w.phrases_alan_cyrillic,
  w.phrases_alan_turkic,
  w.phrases_ru,
  story.name_en as story_name_en,
  story.name_tr as story_name_tr,
  dict.name_en as dictionary_name_en,
  dict.name_tr as dictionary_name_tr,
  sec.name_en as section_name_en,
  sec.name_tr as section_name_tr,
  set_node.name_en as set_name_en,
  set_node.name_tr as set_name_tr,
  w.translation_en,
  w.translation_tr,
  w.phrases_en,
  w.phrases_tr
from public.content_words w
join public.content_structure set_node on set_node.entity_id = w.set_id and set_node.entity_type = 'set'
join public.content_structure sec on sec.entity_id = w.section_id and sec.entity_type = 'section' and set_node.parent_id = sec.entity_id
join public.content_structure dict on dict.entity_id = w.dictionary_id and dict.entity_type = 'dictionary' and sec.parent_id = dict.entity_id
join public.content_structure story on story.entity_id = dict.parent_id and story.entity_type = 'story';

alter table public.content_structure enable row level security;
create policy content_structure_public_read on public.content_structure
  for select to anon, authenticated using (true);
revoke all on public.content_structure from public;
grant select on public.content_structure to anon, authenticated;
grant select on public.content_stories to anon, authenticated;
grant select on public.v_words_app to anon, authenticated;

create or replace function private.canonicalize_hidden_word_scope()
returns trigger
language plpgsql
set search_path to 'pg_catalog','public','private'
as $$
declare
  canonical_dictionary text;
  canonical_section text;
  canonical_set text;
begin
  select w.dictionary_id, w.section_id, w.set_id
    into canonical_dictionary, canonical_section, canonical_set
  from public.content_words w
  where w.word_id = new.word_id;
  if canonical_dictionary is null or canonical_section is null or canonical_set is null then
    raise exception 'Unknown word %', new.word_id;
  end if;
  new.dictionary_id := canonical_dictionary;
  new.section_id := canonical_section;
  new.set_id := canonical_set;
  return new;
end;
$$;

create or replace function private.canonicalize_user_set_progress_scope()
returns trigger
language plpgsql
set search_path to 'pg_catalog','public','private'
as $$
declare
  canonical_dictionary text;
  canonical_section text;
begin
  select w.dictionary_id, w.section_id
    into canonical_dictionary, canonical_section
  from public.content_words w
  where w.set_id = new.set_id
  limit 1;
  if canonical_dictionary is null or canonical_section is null then
    raise exception 'Unknown set %', new.set_id;
  end if;
  new.dictionary_id := canonical_dictionary;
  new.section_id := canonical_section;
  return new;
end;
$$;

create or replace function private.canonicalize_user_station_progress_scope()
returns trigger
language plpgsql
set search_path to 'pg_catalog','public','private'
as $$
declare
  canonical_dictionary text;
  canonical_section text;
  canonical_story text;
begin
  select w.dictionary_id, w.section_id, story.entity_id
    into canonical_dictionary, canonical_section, canonical_story
  from public.content_words w
  join public.content_structure dict on dict.entity_id = w.dictionary_id and dict.entity_type = 'dictionary'
  join public.content_structure story on story.entity_id = dict.parent_id and story.entity_type = 'story'
  where w.set_id = new.set_id
  limit 1;
  if canonical_dictionary is null or canonical_section is null or canonical_story is null then
    raise exception 'Unknown station set %', new.set_id;
  end if;
  new.dictionary_id := canonical_dictionary;
  new.catalog_id := canonical_dictionary;
  new.group_id := canonical_section;
  new.story_type := canonical_story;
  return new;
end;
$$;

create or replace function private.validate_learning_session_scope()
returns trigger
language plpgsql
set search_path to 'pg_catalog','public','private'
as $$
begin
  if new.dictionary_id = '__fav__' then return new; end if;
  if not exists (
    select 1 from public.content_words w
    where w.dictionary_id = new.dictionary_id
      and w.section_id = new.section_id
      and w.set_id = new.set_id
  ) then
    raise exception 'Unknown dictionary/section/set scope: % / % / %', new.dictionary_id, new.section_id, new.set_id;
  end if;
  return new;
end;
$$;

create or replace function private.validate_learning_session_word_scope()
returns trigger
language plpgsql
set search_path to 'pg_catalog','public','private'
as $$
declare
  session_dictionary text;
  session_section text;
  session_set text;
begin
  select s.dictionary_id, s.section_id, s.set_id
    into session_dictionary, session_section, session_set
  from public.learn_sessions s where s.id = new.session_id;
  if session_dictionary is null then raise exception 'Learning session % does not exist', new.session_id; end if;
  if session_dictionary = '__fav__' then
    if not exists (select 1 from public.content_words w where w.word_id = new.word_id) then raise exception 'Unknown word %', new.word_id; end if;
    return new;
  end if;
  if not exists (
    select 1 from public.content_words w
    where w.word_id = new.word_id
      and w.dictionary_id = session_dictionary
      and w.section_id = session_section
      and w.set_id = session_set
  ) then
    raise exception 'Word % does not belong to % / % / %', new.word_id, session_dictionary, session_section, session_set;
  end if;
  return new;
end;
$$;

create or replace function private.validate_station_test_session_scope()
returns trigger
language plpgsql
set search_path to 'pg_catalog','public','private'
as $$
begin
  if new.catalog_id <> new.dictionary_id then
    raise exception 'Station catalog must match dictionary';
  end if;
  if not exists (
    select 1
    from public.content_words w
    join public.content_structure dict on dict.entity_id = w.dictionary_id and dict.entity_type = 'dictionary'
    where w.dictionary_id = new.dictionary_id
      and w.section_id = new.group_id
      and w.set_id = new.set_id
      and dict.parent_id = new.story_type
  ) then
    raise exception 'Unknown station scope: % / % / % / %', new.story_type, new.dictionary_id, new.group_id, new.set_id;
  end if;
  return new;
end;
$$;

create or replace function private.validate_station_test_word_scope()
returns trigger
language plpgsql
set search_path to 'pg_catalog','public','private'
as $$
declare
  session_dictionary text;
  session_section text;
  session_set text;
begin
  select s.dictionary_id, s.group_id, s.set_id
    into session_dictionary, session_section, session_set
  from public.station_test_sessions s where s.id = new.session_id;
  if session_dictionary is null then raise exception 'Station test session % does not exist', new.session_id; end if;
  if not exists (
    select 1 from public.content_words w
    where w.word_id = new.word_id
      and w.dictionary_id = session_dictionary
      and w.section_id = session_section
      and w.set_id = session_set
  ) then
    raise exception 'Word % does not belong to station % / % / %', new.word_id, session_dictionary, session_section, session_set;
  end if;
  return new;
end;
$$;

update public.user_hidden_words h
set dictionary_id = w.dictionary_id,
    section_id = w.section_id,
    set_id = w.set_id,
    updated_at = greatest(h.updated_at, now())
from public.content_words w
where w.word_id = h.word_id;

update public.user_set_progress p
set dictionary_id = w.dictionary_id,
    section_id = w.section_id,
    updated_at = greatest(p.updated_at, now())
from (
  select distinct on (set_id) set_id, dictionary_id, section_id
  from public.content_words
  order by set_id, global_order
) w
where w.set_id = p.set_id;

update public.learn_sessions s
set dictionary_id = w.dictionary_id,
    section_id = w.section_id
from (
  select distinct on (set_id) set_id, dictionary_id, section_id
  from public.content_words
  order by set_id, global_order
) w
where s.dictionary_id <> '__fav__' and s.set_id = w.set_id;

update public.user_station_progress p
set dictionary_id = w.dictionary_id,
    catalog_id = w.dictionary_id,
    group_id = w.section_id,
    story_type = w.story_id,
    updated_at = greatest(p.updated_at, now())
from (
  select distinct on (cw.set_id)
    cw.set_id, cw.dictionary_id, cw.section_id, dict.parent_id as story_id
  from public.content_words cw
  join public.content_structure dict on dict.entity_id = cw.dictionary_id and dict.entity_type = 'dictionary'
  order by cw.set_id, cw.global_order
) w
where p.set_id = w.set_id;

update public.user_rewards r
set catalog_id = w.dictionary_id,
    group_id = w.section_id
from (
  select distinct on (set_id) set_id, dictionary_id, section_id
  from public.content_words
  order by set_id, global_order
) w
where r.set_id = w.set_id;

update public.user_route_settings
set active_story = 'oblivion', updated_at = now()
where selected_dictionary_id = 'beginner' and active_story = 'roots';

alter table public.user_route_settings alter column active_story set default 'oblivion';

update public.dictionary_metadata
set current_version = '13.13.0'
where dictionary_key = 'main';

do $$
begin
  if (select count(*) from public.content_words) <> 2355 then
    raise exception 'Expected 2355 words after hierarchy migration';
  end if;
  if (select count(distinct set_id) from public.content_words) <> 85 then
    raise exception 'Expected 85 sets after hierarchy migration';
  end if;
  if exists (select 1 from public.content_words where section_id is null or btrim(section_id) = '') then
    raise exception 'Every word must have a section';
  end if;
  if (select count(*) from public.content_structure where entity_type = 'story') <> 4 then
    raise exception 'Expected 4 stories';
  end if;
  if (select count(*) from public.content_structure where entity_type = 'dictionary') <> 7 then
    raise exception 'Expected 7 dictionaries';
  end if;
  if (select count(*) from public.content_structure where entity_type = 'section') <> 31 then
    raise exception 'Expected 31 sections';
  end if;
  if (select count(*) from public.content_structure where entity_type = 'set') <> 85 then
    raise exception 'Expected 85 structural sets';
  end if;
  if exists (
    select 1 from public.content_words w
    left join public.content_structure set_node on set_node.entity_id = w.set_id and set_node.entity_type = 'set'
    left join public.content_structure sec on sec.entity_id = w.section_id and sec.entity_type = 'section'
    left join public.content_structure dict on dict.entity_id = w.dictionary_id and dict.entity_type = 'dictionary'
    where set_node.entity_id is null or sec.entity_id is null or dict.entity_id is null
       or set_node.parent_id <> sec.entity_id or sec.parent_id <> dict.entity_id
  ) then
    raise exception 'Orphan or mismatched content hierarchy detected';
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;

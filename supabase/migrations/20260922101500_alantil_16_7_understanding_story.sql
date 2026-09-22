begin;

update public.content_structure
set entity_id = 'understanding',
    name_ru = 'Начать понимать',
    name_en = 'Begin to Understand',
    name_tr = 'Anlamaya Başlamak',
    intro_ru = $ru$Каждый раз, оказываясь в родных краях, не можешь отделаться от странного чувства. Будто между тобой и этими местами стоит невидимая преграда, не дающая почувствовать себя здесь по-настоящему дома.

Язык слышен повсюду — в разговорах, песнях, случайных фразах. Звучание кажется знакомым, но смысл почти всегда ускользает. Песни остаются мелодиями, а речь — потоком слов, за которыми трудно уловить настоящую мысль.

Начать с основ — лучший способ избавиться от ощущения, что ты здесь всего лишь турист. С этого и начинается твой первый путь.$ru$,
    intro_en = $en$Whenever you find yourself back in your homeland, you can't shake a strange feeling. It's as if an invisible barrier stands between you and these places, keeping you from truly feeling at home here.

The language is everywhere — in conversations, songs, and passing phrases. It sounds familiar, yet the meaning almost always slips away. Songs remain melodies, while speech becomes a stream of words whose real meaning is difficult to grasp.

Starting with the basics is the best way to leave behind the feeling that you're only a tourist here. This is where your first path begins.$en$,
    intro_tr = $tr$Her memlekete geldiğinde içinden atamadığın tuhaf bir duygu beliriyor. Sanki seninle bu yerler arasında, burada gerçekten evinde hissetmene engel olan görünmez bir perde var.

Dil her yerde duyuluyor — konuşmalarda, şarkılarda, arada söylenen cümlelerde. Tınısı tanıdık geliyor ama anlamı çoğu zaman kaçıp gidiyor. Şarkılar melodi olarak kalıyor, konuşmalar ise ardındaki gerçek anlamı yakalamanın zor olduğu bir kelime akışına dönüşüyor.

Temelden başlamak, burada yalnızca bir turistmişsin gibi hissetmekten kurtulmanın en iyi yolu. İlk yolun da burada başlıyor.$tr$
where entity_type = 'story'
  and entity_id = 'oblivion';

update public.content_words set story_id = 'understanding' where story_id = 'oblivion';
update public.station_test_sessions set story_type = 'understanding' where story_type = 'oblivion';
update public.user_station_progress set story_type = 'understanding' where story_type = 'oblivion';
update public.user_route_settings set active_story = 'understanding' where active_story = 'oblivion';

create or replace view public.content_stories as
select
  entity_id as story_id,
  case entity_id
    when 'understanding' then 1
    when 'roots' then 2
    when 'ascent' then 3
    when 'pathways' then 4
    else 999
  end as story_order,
  case entity_id
    when 'understanding' then array['beginner'::text]
    when 'roots' then array['intermediate'::text]
    when 'ascent' then array['advanced'::text]
    when 'pathways' then array['thematic'::text]
    else array[]::text[]
  end as dictionary_ids,
  name_alan_cyrillic, name_alan_turkic, name_ru, name_en, name_tr,
  intro_alan_cyrillic, intro_alan_turkic, intro_ru, intro_en, intro_tr
from public.content_structure
where entity_type = 'story';

do $migration$
declare
  fn record;
  fn_sql text;
begin
  for fn in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'admin_station_test_detail',
        'admin_user_activity_detail',
        'admin_user_activity_list',
        'admin_user_test_history'
      )
  loop
    fn_sql := pg_get_functiondef(fn.oid);
    if position('oblivion' in fn_sql) > 0 then
      execute replace(fn_sql, 'oblivion', 'understanding');
    end if;
  end loop;
end
$migration$;

update public.dictionary_metadata
set current_version = '2026.09.22.1'
where dictionary_key = 'main';

do $validation$
declare
  invalid_count integer;
begin
  select count(*) into invalid_count
  from public.content_structure
  where entity_type = 'story'
    and entity_id = 'understanding'
    and name_ru = 'Начать понимать'
    and name_en = 'Begin to Understand'
    and name_tr = 'Anlamaya Başlamak';
  if invalid_count <> 1 then
    raise exception 'Understanding story localization validation failed';
  end if;

  if exists (select 1 from public.content_structure where entity_type='story' and entity_id='oblivion')
     or exists (select 1 from public.content_words where story_id='oblivion')
     or exists (select 1 from public.station_test_sessions where story_type='oblivion')
     or exists (select 1 from public.user_station_progress where story_type='oblivion')
     or exists (select 1 from public.user_route_settings where active_story='oblivion') then
    raise exception 'Legacy oblivion story id remains in runtime data';
  end if;

  if not exists (
    select 1 from public.content_stories
    where story_id='understanding'
      and story_order=1
      and dictionary_ids=array['beginner'::text]
  ) then
    raise exception 'content_stories mapping for understanding is invalid';
  end if;
end
$validation$;

notify pgrst, 'reload schema';
commit;

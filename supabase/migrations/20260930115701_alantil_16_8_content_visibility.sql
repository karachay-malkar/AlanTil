alter table public.content_structure
  add column if not exists is_visible boolean not null default true;

comment on column public.content_structure.is_visible is
  'Administrative visibility flag. App visibility is effective only when this node and every ancestor in the content_words hierarchy are visible.';

create or replace function private.content_structure_effectively_visible(
  p_entity_type text,
  p_entity_id text
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select case p_entity_type
    when 'story' then exists (
      select 1
      from public.content_structure s
      where s.entity_type = 'story'
        and s.entity_id = p_entity_id
        and s.is_visible
    )
    when 'dictionary' then exists (
      select 1
      from public.content_words w
      join public.content_structure story
        on story.entity_type = 'story' and story.entity_id = w.story_id
      join public.content_structure dict
        on dict.entity_type = 'dictionary' and dict.entity_id = w.dictionary_id
      where w.dictionary_id = p_entity_id
        and story.is_visible
        and dict.is_visible
    )
    when 'section' then exists (
      select 1
      from public.content_words w
      join public.content_structure story
        on story.entity_type = 'story' and story.entity_id = w.story_id
      join public.content_structure dict
        on dict.entity_type = 'dictionary' and dict.entity_id = w.dictionary_id
      join public.content_structure sec
        on sec.entity_type = 'section' and sec.entity_id = w.section_id
      where w.section_id = p_entity_id
        and story.is_visible
        and dict.is_visible
        and sec.is_visible
    )
    when 'set' then exists (
      select 1
      from public.content_words w
      join public.content_structure story
        on story.entity_type = 'story' and story.entity_id = w.story_id
      join public.content_structure dict
        on dict.entity_type = 'dictionary' and dict.entity_id = w.dictionary_id
      join public.content_structure sec
        on sec.entity_type = 'section' and sec.entity_id = w.section_id
      join public.content_structure set_node
        on set_node.entity_type = 'set' and set_node.entity_id = w.set_id
      where w.set_id = p_entity_id
        and story.is_visible
        and dict.is_visible
        and sec.is_visible
        and set_node.is_visible
    )
    else false
  end;
$function$;

revoke all on function private.content_structure_effectively_visible(text,text) from public;
grant execute on function private.content_structure_effectively_visible(text,text) to anon, authenticated, service_role;

drop policy if exists content_structure_public_read on public.content_structure;
create policy content_structure_public_read
on public.content_structure
for select
to anon, authenticated
using (private.content_structure_effectively_visible(entity_type, entity_id));

create or replace view public.v_words_app
with (security_invoker = true)
as
select
  w.word_id,
  w.global_order,
  w.story_id,
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
join public.content_structure story
  on story.entity_type = 'story' and story.entity_id = w.story_id
join public.content_structure dict
  on dict.entity_type = 'dictionary' and dict.entity_id = w.dictionary_id
join public.content_structure sec
  on sec.entity_type = 'section' and sec.entity_id = w.section_id
join public.content_structure set_node
  on set_node.entity_type = 'set' and set_node.entity_id = w.set_id
where story.is_visible
  and dict.is_visible
  and sec.is_visible
  and set_node.is_visible;

create or replace view public.content_stories
with (security_invoker = true)
as
with visible_pairs as (
  select
    w.story_id,
    w.dictionary_id,
    min(w.global_order) as first_order
  from public.v_words_app w
  group by w.story_id, w.dictionary_id
),
story_dictionaries as (
  select
    story_id,
    array_agg(dictionary_id order by first_order, dictionary_id) as dictionary_ids
  from visible_pairs
  group by story_id
)
select
  story.entity_id as story_id,
  case story.entity_id
    when 'understanding' then 1
    when 'roots' then 2
    when 'ascent' then 3
    when 'pathways' then 4
    else 999
  end as story_order,
  coalesce(sd.dictionary_ids, array[]::text[]) as dictionary_ids,
  story.name_alan_cyrillic,
  story.name_alan_turkic,
  story.name_ru,
  story.name_en,
  story.name_tr,
  story.intro_alan_cyrillic,
  story.intro_alan_turkic,
  story.intro_ru,
  story.intro_en,
  story.intro_tr
from public.content_structure story
left join story_dictionaries sd on sd.story_id = story.entity_id
where story.entity_type = 'story'
  and story.is_visible;

create or replace function private.bump_dictionary_version_on_visibility()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if old.is_visible is distinct from new.is_visible then
    update public.dictionary_metadata
    set current_version = to_char(clock_timestamp() at time zone 'UTC', 'YYYY.MM.DD.HH24MISS.MS')
    where dictionary_key = 'main';
  end if;
  return new;
end;
$function$;

revoke all on function private.bump_dictionary_version_on_visibility() from public;

drop trigger if exists trg_content_structure_visibility_version on public.content_structure;
create trigger trg_content_structure_visibility_version
after update of is_visible on public.content_structure
for each row
when (old.is_visible is distinct from new.is_visible)
execute function private.bump_dictionary_version_on_visibility();

update public.content_structure
set is_visible = false
where entity_type = 'story'
  and entity_id = 'ascent'
  and is_visible;

do $verify$
declare
  hidden_words integer;
  visible_roots integer;
begin
  select count(*) into hidden_words from public.v_words_app where story_id = 'ascent';
  if hidden_words <> 0 then
    raise exception 'visibility migration failed: ascent still exposes % words', hidden_words;
  end if;

  if private.content_structure_effectively_visible('story','ascent') then
    raise exception 'visibility migration failed: ascent story is effectively visible';
  end if;
  if private.content_structure_effectively_visible('dictionary','advanced') then
    raise exception 'visibility migration failed: advanced dictionary is effectively visible';
  end if;

  select count(*) into visible_roots from public.v_words_app where story_id = 'roots';
  if visible_roots <> 780 then
    raise exception 'visibility migration failed: roots changed unexpectedly (%)', visible_roots;
  end if;
end;
$verify$;

update public.content_structure
set name_ru = null,
    name_en = null,
    name_tr = null,
    name_alan_cyrillic = null,
    name_alan_turkic = null
where entity_type = 'section'
  and entity_id in ('beginner-elementary', 'beginner-lower');

update public.dictionary_metadata
set current_version = '2026.09.23.1'
where dictionary_key = 'main';

do $validation$
begin
  if (
    select count(*)
    from public.content_structure
    where entity_type = 'section'
      and entity_id in ('beginner-elementary', 'beginner-lower')
  ) <> 2 then
    raise exception 'Expected exactly 2 beginner sections';
  end if;

  if exists (
    select 1
    from public.content_structure
    where entity_type = 'section'
      and entity_id in ('beginner-elementary', 'beginner-lower')
      and (
        name_ru is not null
        or name_en is not null
        or name_tr is not null
        or name_alan_cyrillic is not null
        or name_alan_turkic is not null
      )
  ) then
    raise exception 'Beginner section labels were not cleared';
  end if;

  if not exists (
    select 1
    from public.content_structure
    where entity_type = 'dictionary'
      and entity_id = 'beginner'
      and name_ru = 'Начальный'
  ) then
    raise exception 'Beginner dictionary metadata must remain intact';
  end if;
end
$validation$;

notify pgrst, 'reload schema';

begin;

update public.content_structure as c
set name_ru = v.name_ru,
    name_en = v.name_en,
    name_tr = v.name_tr
from (
  values
    ('beginner-09', 'Проезжая через посёлок', 'Passing Through Town', 'Kasabadan Geçerken'),
    ('beginner-20', 'Тихое озеро', 'Quiet Lake', 'Sakin Göl')
) as v(entity_id, name_ru, name_en, name_tr)
where c.entity_type = 'set'
  and c.entity_id = v.entity_id;

update public.dictionary_metadata
set current_version = '2026.09.22.4'
where dictionary_key = 'main';

do $validation$
begin
  if not exists (
    select 1
    from public.content_structure
    where entity_type = 'set'
      and entity_id = 'beginner-09'
      and name_ru = 'Проезжая через посёлок'
      and name_en = 'Passing Through Town'
      and name_tr = 'Kasabadan Geçerken'
  ) then
    raise exception 'beginner-09 localization polish failed';
  end if;

  if not exists (
    select 1
    from public.content_structure
    where entity_type = 'set'
      and entity_id = 'beginner-20'
      and name_ru = 'Тихое озеро'
      and name_en = 'Quiet Lake'
      and name_tr = 'Sakin Göl'
  ) then
    raise exception 'beginner-20 localization polish failed';
  end if;
end
$validation$;

notify pgrst, 'reload schema';
commit;

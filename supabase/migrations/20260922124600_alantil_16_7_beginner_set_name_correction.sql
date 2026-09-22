begin;

update public.content_structure
set name_ru = 'Проезжая через поселок'
where entity_type = 'set'
  and entity_id = 'beginner-09';

update public.dictionary_metadata
set current_version = '2026.09.22.3'
where dictionary_key = 'main';

do $validation$
begin
  if not exists (
    select 1
    from public.content_structure
    where entity_type = 'set'
      and entity_id = 'beginner-09'
      and name_ru = 'Проезжая через поселок'
      and name_en = 'Passing Through Town'
      and name_tr = 'Kasabadan Geçerken'
  ) then
    raise exception 'beginner-09 localization correction failed';
  end if;
end
$validation$;

notify pgrst, 'reload schema';
commit;

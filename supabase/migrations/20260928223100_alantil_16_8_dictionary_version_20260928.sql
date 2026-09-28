begin;

insert into public.dictionary_metadata (dictionary_key, current_version)
values ('main', '2026.09.28.1')
on conflict (dictionary_key) do update
set current_version = excluded.current_version;

commit;

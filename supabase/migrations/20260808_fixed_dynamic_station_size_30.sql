-- AlanTil 13.11.1
-- Dynamic stations are fixed at 30 words in the application.
-- Legacy 20/40 values remain accepted temporarily so older cached clients do
-- not fail while the new application version rolls out.

begin;

update public.user_settings
set station_size = 30,
    updated_at = now()
where station_size is distinct from 30;

alter table public.user_settings
  alter column station_size set default 30;

alter table public.user_settings
  drop constraint if exists user_settings_station_size_check;

alter table public.user_settings
  add constraint user_settings_station_size_check
  check (station_size in (20, 30, 40));

commit;

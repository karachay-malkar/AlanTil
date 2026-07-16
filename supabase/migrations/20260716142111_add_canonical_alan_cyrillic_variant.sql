-- Add the canonical Җ display option without changing existing user choices.

alter table public.user_settings
  alter column alan_dialect_code set default 'canonical';

alter table public.user_settings
  drop constraint if exists user_settings_alan_dialect_code_check;

alter table public.user_settings
  add constraint user_settings_alan_dialect_code_check
  check (alan_dialect_code in ('canonical', 'karachay', 'balkar')) not valid;

alter table public.user_settings
  validate constraint user_settings_alan_dialect_code_check;

comment on column public.user_settings.alan_dialect_code is
  'Cyrillic display variant: canonical keeps Җ, karachay renders Дж, balkar renders Ж.';

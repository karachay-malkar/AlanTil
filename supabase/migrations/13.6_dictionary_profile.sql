-- AlanTil 13.6: dictionary version metadata and immutable avatar gender.
-- Run in Supabase SQL Editor before publishing the web application.

begin;

alter table public.profiles add column if not exists avatar_gender text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_avatar_gender'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_avatar_gender
      check (avatar_gender is null or avatar_gender in ('male', 'female'));
  end if;
end;
$$;

create or replace function public.protect_avatar_gender()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.avatar_gender is not null and new.avatar_gender is distinct from old.avatar_gender then
    raise exception 'avatar_gender cannot be changed after selection';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_avatar_gender on public.profiles;
create trigger profiles_protect_avatar_gender
before update of avatar_gender on public.profiles
for each row execute function public.protect_avatar_gender();

create table if not exists public.dictionary_metadata (
  dictionary_key text primary key,
  current_version text not null,
  constraint dictionary_metadata_key_not_empty check (char_length(btrim(dictionary_key)) > 0),
  constraint dictionary_metadata_version_not_empty check (char_length(btrim(current_version)) > 0)
);

insert into public.dictionary_metadata (dictionary_key, current_version)
values ('main', '05.07.2026')
on conflict (dictionary_key) do nothing;

alter table public.dictionary_metadata enable row level security;
revoke all on public.dictionary_metadata from public;
grant select on public.dictionary_metadata to anon, authenticated;

drop policy if exists dictionary_metadata_read on public.dictionary_metadata;
create policy dictionary_metadata_read on public.dictionary_metadata
for select to anon, authenticated
using (true);

commit;

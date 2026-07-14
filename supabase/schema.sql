-- AlanTil 12.3
-- Run this file once in Supabase Dashboard -> SQL Editor.

begin;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_nickname_length check (char_length(nickname) between 3 and 30),
  constraint profiles_nickname_trimmed check (nickname = btrim(nickname)),
  constraint profiles_nickname_characters check (nickname ~ '^[[:alnum:]_]+$')
);

create unique index if not exists profiles_nickname_unique_ci
  on public.profiles (lower(nickname));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.is_nickname_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    candidate is not null
    and char_length(btrim(candidate)) between 3 and 30
    and btrim(candidate) ~ '^[[:alnum:]_]+$'
    and not exists (
      select 1
      from public.profiles
      where lower(nickname) = lower(btrim(candidate))
    );
$$;

revoke execute on function public.is_nickname_available(text) from public, anon;
grant execute on function public.is_nickname_available(text) to authenticated;

-- Addresses in this table cannot create a new Supabase Auth user after
-- the Before User Created hook below has been enabled in the dashboard.
create table if not exists public.blocked_emails (
  email text primary key,
  reason text,
  created_at timestamptz not null default now(),
  created_by text not null default 'dashboard',
  constraint blocked_emails_not_empty check (char_length(btrim(email)) > 3),
  constraint blocked_emails_normalized check (email = lower(btrim(email)))
);

alter table public.blocked_emails enable row level security;
revoke all on table public.blocked_emails from anon, authenticated;
grant select on table public.blocked_emails to supabase_auth_admin;

drop policy if exists blocked_emails_auth_hook_select on public.blocked_emails;
create policy blocked_emails_auth_hook_select
on public.blocked_emails
for select
to supabase_auth_admin
using (true);

create or replace function public.normalize_blocked_email()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.email = lower(btrim(new.email));
  return new;
end;
$$;

drop trigger if exists blocked_emails_normalize on public.blocked_emails;
create trigger blocked_emails_normalize
before insert or update on public.blocked_emails
for each row execute function public.normalize_blocked_email();

create or replace function public.hook_reject_blocked_email(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  candidate_email text;
begin
  candidate_email := lower(btrim(coalesce(event->'user'->>'email', '')));

  if candidate_email <> '' and exists (
    select 1
    from public.blocked_emails
    where email = candidate_email
  ) then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Вход или регистрация для этого адреса недоступны.'
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_reject_blocked_email(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_reject_blocked_email(jsonb) from public, anon, authenticated;

commit;

-- Refresh the PostgREST schema cache after creating tables and functions.
notify pgrst, 'reload schema';

-- Examples for the SQL Editor:
-- Permanently block an email from creating a new account:
-- insert into public.blocked_emails (email, reason)
-- values ('example@gmail.com', 'Blocked by administrator')
-- on conflict (email) do update set reason = excluded.reason;
--
-- Remove the permanent email block:
-- delete from public.blocked_emails where email = 'example@gmail.com';

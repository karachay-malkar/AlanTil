begin;

-- CI and preview browsers must not generate production analytics.
-- Existing historical rows are kept intact.
create or replace function private.is_test_analytics_request()
returns boolean
language sql stable
set search_path = ''
as $$
  with headers as (
    select coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb as h
  )
  select
    coalesce((h->>'referer') ~* '^https?://(localhost|127[.]0[.]0[.]1|0[.]0[.]0[.]0)(:[0-9]+)?(/|$)', false)
    or coalesce((h->>'origin') ~* '^https?://(localhost|127[.]0[.]0[.]1|0[.]0[.]0[.]0)(:[0-9]+)?(/|$)', false)
    or coalesce((h->>'user-agent') ~* 'HeadlessChrome', false)
  from headers;
$$;

create or replace function private.skip_test_analytics_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_test_analytics_request() then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists ignore_test_visit_analytics on public.anonymous_visit_sessions;
create trigger ignore_test_visit_analytics
before insert or update on public.anonymous_visit_sessions
for each row execute function private.skip_test_analytics_write();

drop trigger if exists ignore_test_usage_analytics on public.app_usage_events;
create trigger ignore_test_usage_analytics
before insert on public.app_usage_events
for each row execute function private.skip_test_analytics_write();

revoke all on function private.is_test_analytics_request() from public, anon, authenticated;
revoke all on function private.skip_test_analytics_write() from public, anon, authenticated;

commit;

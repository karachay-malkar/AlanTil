-- AlanTil 13.15.8 — consented anonymous visit analytics.
-- The table is intentionally unreadable from browser roles. Clients can only
-- write through the narrowly-scoped record_anonymous_visit RPC.

begin;

create table if not exists public.anonymous_visit_sessions (
  session_id uuid primary key,
  visitor_id uuid not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  pageviews bigint not null default 1 check (pageviews > 0),
  first_path text not null,
  last_path text not null,
  referrer_host text,
  app_version text not null default 'unknown',
  constraint anonymous_visit_sessions_first_path_length check (char_length(first_path) between 1 and 300),
  constraint anonymous_visit_sessions_last_path_length check (char_length(last_path) between 1 and 300),
  constraint anonymous_visit_sessions_referrer_length check (referrer_host is null or char_length(referrer_host) <= 253),
  constraint anonymous_visit_sessions_app_version_length check (char_length(app_version) between 1 and 32)
);

create index if not exists anonymous_visit_sessions_visitor_seen_idx
  on public.anonymous_visit_sessions (visitor_id, first_seen_at desc);

create index if not exists anonymous_visit_sessions_last_seen_idx
  on public.anonymous_visit_sessions (last_seen_at desc);

alter table public.anonymous_visit_sessions enable row level security;
revoke all on table public.anonymous_visit_sessions from public, anon, authenticated;

create or replace function public.record_anonymous_visit(
  p_visitor_id uuid,
  p_session_id uuid,
  p_page_path text,
  p_referrer_host text default null,
  p_app_version text default 'unknown'
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_page_path text;
  v_referrer_host text;
  v_app_version text;
begin
  if p_visitor_id is null or p_session_id is null then
    raise exception 'visitor_id and session_id are required';
  end if;

  v_page_path := left(coalesce(nullif(btrim(p_page_path), ''), '/'), 300);
  v_page_path := split_part(split_part(v_page_path, '?', 1), '#', 1);
  if left(v_page_path, 1) <> '/' then
    v_page_path := '/';
  end if;

  v_referrer_host := lower(left(nullif(btrim(p_referrer_host), ''), 253));
  if v_referrer_host is not null and v_referrer_host !~ '^[a-z0-9.-]+$' then
    v_referrer_host := null;
  end if;

  v_app_version := left(regexp_replace(coalesce(nullif(btrim(p_app_version), ''), 'unknown'), '[^0-9A-Za-z._-]', '', 'g'), 32);
  if v_app_version = '' then
    v_app_version := 'unknown';
  end if;

  insert into public.anonymous_visit_sessions (
    session_id,
    visitor_id,
    first_seen_at,
    last_seen_at,
    pageviews,
    first_path,
    last_path,
    referrer_host,
    app_version
  ) values (
    p_session_id,
    p_visitor_id,
    now(),
    now(),
    1,
    v_page_path,
    v_page_path,
    v_referrer_host,
    v_app_version
  )
  on conflict (session_id) do update
  set
    last_seen_at = now(),
    pageviews = public.anonymous_visit_sessions.pageviews + 1,
    last_path = excluded.last_path,
    referrer_host = coalesce(public.anonymous_visit_sessions.referrer_host, excluded.referrer_host),
    app_version = excluded.app_version
  where public.anonymous_visit_sessions.visitor_id = excluded.visitor_id;
end;
$$;

revoke all on function public.record_anonymous_visit(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.record_anonymous_visit(uuid, uuid, text, text, text) to anon, authenticated;

comment on table public.anonymous_visit_sessions is
  'Consent-gated anonymous browser visit sessions for aggregate product analytics.';
comment on function public.record_anonymous_visit(uuid, uuid, text, text, text) is
  'Records or advances one anonymous visit session without exposing analytics rows to browser roles.';

commit;

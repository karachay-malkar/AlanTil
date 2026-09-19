begin;

alter table public.anonymous_visit_sessions
  add column if not exists started_as_guest boolean,
  add column if not exists platform text,
  add column if not exists interface_language text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='anonymous_visit_sessions_platform_check'
      and conrelid='public.anonymous_visit_sessions'::regclass
  ) then
    alter table public.anonymous_visit_sessions
      add constraint anonymous_visit_sessions_platform_check
      check (platform is null or platform in ('web','mobile'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname='anonymous_visit_sessions_language_check'
      and conrelid='public.anonymous_visit_sessions'::regclass
  ) then
    alter table public.anonymous_visit_sessions
      add constraint anonymous_visit_sessions_language_check
      check (interface_language is null or interface_language in ('ru','en','tr'));
  end if;
end $$;

create index if not exists anonymous_visit_sessions_guest_seen_idx
  on public.anonymous_visit_sessions (started_as_guest, first_seen_at desc);

create or replace function private.record_visit_analytics_impl(
  p_visitor_id uuid,
  p_session_id uuid,
  p_page_path text,
  p_referrer_host text,
  p_app_version text,
  p_platform text,
  p_interface_language text
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_page_path text;
  v_referrer_host text;
  v_app_version text;
  v_platform text;
  v_language text;
  v_user_id uuid:=auth.uid();
  v_started_as_guest boolean:=(auth.uid() is null);
begin
  if p_visitor_id is null or p_session_id is null then
    raise exception 'visitor_id and session_id are required';
  end if;

  v_page_path:=left(coalesce(nullif(btrim(p_page_path),''),'/'),300);
  v_page_path:=split_part(split_part(v_page_path,'?',1),'#',1);
  if left(v_page_path,1)<>'/' then v_page_path:='/'; end if;

  v_referrer_host:=lower(left(nullif(btrim(p_referrer_host),''),253));
  if v_referrer_host is not null and v_referrer_host !~ '^[a-z0-9.-]+$' then
    v_referrer_host:=null;
  end if;

  v_app_version:=left(regexp_replace(coalesce(nullif(btrim(p_app_version),''),'unknown'),'[^0-9A-Za-z._-]','','g'),32);
  if v_app_version='' then v_app_version:='unknown'; end if;

  v_platform:=lower(nullif(btrim(p_platform),''));
  if v_platform not in ('web','mobile') then
    v_platform:=case when v_page_path like '/mobile/%' then 'mobile' else 'web' end;
  end if;

  v_language:=lower(split_part(coalesce(nullif(btrim(p_interface_language),''),''),'-',1));
  if v_language not in ('ru','en','tr') then v_language:=null; end if;

  insert into public.anonymous_visit_sessions(
    session_id,visitor_id,user_id,first_seen_at,last_seen_at,pageviews,
    first_path,last_path,referrer_host,app_version,
    started_as_guest,platform,interface_language
  ) values(
    p_session_id,p_visitor_id,v_user_id,now(),now(),1,
    v_page_path,v_page_path,v_referrer_host,v_app_version,
    v_started_as_guest,v_platform,v_language
  )
  on conflict(session_id) do update
  set
    user_id=coalesce(public.anonymous_visit_sessions.user_id,excluded.user_id),
    last_seen_at=now(),
    pageviews=public.anonymous_visit_sessions.pageviews+1,
    last_path=excluded.last_path,
    referrer_host=coalesce(public.anonymous_visit_sessions.referrer_host,excluded.referrer_host),
    app_version=excluded.app_version,
    platform=coalesce(public.anonymous_visit_sessions.platform,excluded.platform),
    interface_language=coalesce(excluded.interface_language,public.anonymous_visit_sessions.interface_language)
  where public.anonymous_visit_sessions.visitor_id=excluded.visitor_id
    and (
      public.anonymous_visit_sessions.user_id is null
      or excluded.user_id is null
      or public.anonymous_visit_sessions.user_id=excluded.user_id
    );
end;
$$;

revoke all on function private.record_visit_analytics_impl(uuid,uuid,text,text,text,text,text) from public,anon,authenticated;

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
set search_path=''
as $$
begin
  perform private.record_visit_analytics_impl(
    p_visitor_id,p_session_id,p_page_path,p_referrer_host,p_app_version,null,null
  );
end;
$$;

create or replace function public.record_anonymous_visit_v2(
  p_visitor_id uuid,
  p_session_id uuid,
  p_page_path text,
  p_referrer_host text default null,
  p_app_version text default 'unknown',
  p_platform text default null,
  p_interface_language text default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  perform private.record_visit_analytics_impl(
    p_visitor_id,p_session_id,p_page_path,p_referrer_host,p_app_version,p_platform,p_interface_language
  );
end;
$$;

revoke all on function public.record_anonymous_visit(uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.record_anonymous_visit_v2(uuid,uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.record_anonymous_visit(uuid,uuid,text,text,text) to anon,authenticated;
grant execute on function public.record_anonymous_visit_v2(uuid,uuid,text,text,text,text,text) to anon,authenticated;

comment on column public.anonymous_visit_sessions.started_as_guest is
  'Immutable-at-session-create flag. Null means historical session recorded before 16.7 guest analytics.';
comment on column public.anonymous_visit_sessions.platform is
  'Explicit client surface: web or mobile. Historical nulls are preserved.';
comment on column public.anonymous_visit_sessions.interface_language is
  'Latest known interface language for the visit session: ru, en or tr.';
comment on function public.record_anonymous_visit_v2(uuid,uuid,text,text,text,text,text) is
  'Records consented visit analytics with explicit platform/language. started_as_guest is derived server-side and never changed on upsert.';

create or replace function public.admin_guest_analytics(p_period_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_min_seen timestamptz;
  v_start timestamptz;
  v_days integer;
  v_bucket text:='day';
  v_result jsonb;
begin
  if v_actor is null or not exists(
    select 1 from public.profiles p
    where p.user_id=v_actor and p.activity_access is true
  ) then
    raise exception 'activity access denied' using errcode='42501';
  end if;

  select min(av.first_seen_at) into v_min_seen
  from public.anonymous_visit_sessions av
  where av.started_as_guest is true
     or (av.started_as_guest is null and av.user_id is null);

  v_days:=case
    when p_period_days is null then 30
    when p_period_days<=0 then 0
    else least(greatest(p_period_days,1),3650)
  end;

  if v_days=0 then
    v_start:=date_trunc('day',coalesce(v_min_seen,now()));
  else
    v_start:=date_trunc('day',now())-((v_days-1)::text||' days')::interval;
  end if;

  if v_days=0 and now()-v_start>interval '120 days' then
    v_bucket:='week';
  end if;

  with guest_all as (
    select
      av.*,
      coalesce(av.platform,case when av.first_path like '/mobile/%' then 'mobile' else 'web' end) as platform_value
    from public.anonymous_visit_sessions av
    where av.started_as_guest is true
       or (av.started_as_guest is null and av.user_id is null)
  ),
  selected as (
    select * from guest_all g where g.first_seen_at>=v_start
  ),
  visitor_first as (
    select g.visitor_id,min(g.first_seen_at) as first_guest_seen
    from guest_all g group by g.visitor_id
  ),
  period_visitor_counts as (
    select s.visitor_id,count(*)::int as session_count
    from selected s group by s.visitor_id
  ),
  visitor_summary as (
    select
      count(*)::int as unique_visitors,
      count(*) filter(where pvc.session_count>1)::int as repeat_visitors,
      count(*) filter(where vf.first_guest_seen>=v_start)::int as new_visitors,
      count(*) filter(where vf.first_guest_seen<v_start)::int as returning_visitors
    from period_visitor_counts pvc
    join visitor_first vf on vf.visitor_id=pvc.visitor_id
  ),
  session_summary as (
    select
      count(*)::int as sessions,
      coalesce(sum(s.pageviews),0)::bigint as pageviews,
      min(s.first_seen_at) as first_seen_at,
      max(s.last_seen_at) as last_seen_at,
      count(*) filter(where s.started_as_guest is null)::int as legacy_unknown_sessions
    from selected s
  ),
  exact_conversion as (
    select
      count(distinct s.visitor_id) filter(where s.started_as_guest is true)::int as known_guest_visitors,
      count(distinct s.visitor_id) filter(where s.started_as_guest is true and s.user_id is not null)::int as converted_visitors
    from selected s
  ),
  bucket_points as (
    select
      date_trunc(v_bucket,s.first_seen_at) as bucket_start,
      count(*)::int as sessions,
      count(distinct s.visitor_id)::int as unique_visitors,
      coalesce(sum(s.pageviews),0)::bigint as pageviews
    from selected s
    group by 1
  ),
  bucket_series as (
    select generate_series(
      date_trunc(v_bucket,v_start),
      date_trunc(v_bucket,now()),
      case when v_bucket='week' then interval '7 days' else interval '1 day' end
    ) as bucket_start
  ),
  timeline as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'date',to_char(bs.bucket_start,'YYYY-MM-DD'),
      'sessions',coalesce(bp.sessions,0),
      'unique_visitors',coalesce(bp.unique_visitors,0),
      'pageviews',coalesce(bp.pageviews,0)
    ) order by bs.bucket_start),'[]'::jsonb) as value
    from bucket_series bs
    left join bucket_points bp on bp.bucket_start=bs.bucket_start
  ),
  sources as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'label',x.label,'sessions',x.sessions,'unique_visitors',x.unique_visitors
    ) order by x.sessions desc,x.label),'[]'::jsonb) as value
    from (
      select coalesce(nullif(s.referrer_host,''),'direct/unknown') as label,
             count(*)::int as sessions,count(distinct s.visitor_id)::int as unique_visitors
      from selected s group by 1 order by 2 desc limit 12
    ) x
  ),
  platforms as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'label',x.label,'sessions',x.sessions,'unique_visitors',x.unique_visitors
    ) order by x.sessions desc,x.label),'[]'::jsonb) as value
    from (
      select s.platform_value as label,count(*)::int as sessions,count(distinct s.visitor_id)::int as unique_visitors
      from selected s group by 1 order by 2 desc
    ) x
  ),
  entry_paths as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'label',x.label,'sessions',x.sessions,'unique_visitors',x.unique_visitors
    ) order by x.sessions desc,x.label),'[]'::jsonb) as value
    from (
      select s.first_path as label,count(*)::int as sessions,count(distinct s.visitor_id)::int as unique_visitors
      from selected s group by 1 order by 2 desc limit 12
    ) x
  ),
  versions as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'label',x.label,'sessions',x.sessions,'unique_visitors',x.unique_visitors
    ) order by x.sessions desc,x.label),'[]'::jsonb) as value
    from (
      select coalesce(nullif(s.app_version,''),'unknown') as label,count(*)::int as sessions,count(distinct s.visitor_id)::int as unique_visitors
      from selected s group by 1 order by 2 desc limit 12
    ) x
  ),
  languages as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'label',x.label,'sessions',x.sessions,'unique_visitors',x.unique_visitors
    ) order by x.sessions desc,x.label),'[]'::jsonb) as value
    from (
      select coalesce(s.interface_language,'unknown') as label,count(*)::int as sessions,count(distinct s.visitor_id)::int as unique_visitors
      from selected s group by 1 order by 2 desc limit 12
    ) x
  )
  select jsonb_build_object(
    'period_days',v_days,
    'bucket',v_bucket,
    'summary',jsonb_build_object(
      'unique_visitors',coalesce(vs.unique_visitors,0),
      'sessions',coalesce(ss.sessions,0),
      'pageviews',coalesce(ss.pageviews,0),
      'avg_pages_per_session',case when coalesce(ss.sessions,0)>0 then round((ss.pageviews::numeric/ss.sessions::numeric),2) else 0 end,
      'repeat_visitors',coalesce(vs.repeat_visitors,0),
      'new_visitors',coalesce(vs.new_visitors,0),
      'returning_visitors',coalesce(vs.returning_visitors,0),
      'first_seen_at',ss.first_seen_at,
      'last_seen_at',ss.last_seen_at,
      'legacy_unknown_sessions',coalesce(ss.legacy_unknown_sessions,0)
    ),
    'conversion',jsonb_build_object(
      'known_guest_visitors',coalesce(ec.known_guest_visitors,0),
      'converted_visitors',coalesce(ec.converted_visitors,0),
      'rate',case when coalesce(ec.known_guest_visitors,0)>0 then round((ec.converted_visitors::numeric*100/ec.known_guest_visitors::numeric),1) else null end
    ),
    'timeline',tl.value,
    'sources',src.value,
    'platforms',pf.value,
    'entry_paths',ep.value,
    'versions',ver.value,
    'languages',lang.value
  ) into v_result
  from visitor_summary vs
  cross join session_summary ss
  cross join exact_conversion ec
  cross join timeline tl
  cross join sources src
  cross join platforms pf
  cross join entry_paths ep
  cross join versions ver
  cross join languages lang;

  return coalesce(v_result,jsonb_build_object(
    'period_days',v_days,'bucket',v_bucket,
    'summary',jsonb_build_object('unique_visitors',0,'sessions',0,'pageviews',0,'avg_pages_per_session',0,'repeat_visitors',0,'new_visitors',0,'returning_visitors',0,'legacy_unknown_sessions',0),
    'conversion',jsonb_build_object('known_guest_visitors',0,'converted_visitors',0,'rate',null),
    'timeline','[]'::jsonb,'sources','[]'::jsonb,'platforms','[]'::jsonb,'entry_paths','[]'::jsonb,'versions','[]'::jsonb,'languages','[]'::jsonb
  ));
end;
$$;

revoke all on function public.admin_guest_analytics(integer) from public,anon,authenticated;
grant execute on function public.admin_guest_analytics(integer) to authenticated;

comment on function public.admin_guest_analytics(integer) is
  'Protected aggregate guest analytics. Requires profiles.activity_access and never exposes raw visitor identifiers.';

commit;

begin;

-- Part 1 source audit: stop copying canonical domain completions into app_usage_events.
drop trigger if exists learn_sessions_capture_usage on public.learn_sessions;
drop trigger if exists station_test_sessions_capture_usage on public.station_test_sessions;
drop trigger if exists ashyk_rooms_capture_usage on public.ashyk_rooms;

drop function if exists public.capture_learn_usage_event();
drop function if exists public.capture_station_test_usage_event();
drop function if exists public.capture_ashyk_online_usage_event();

-- Remove only rows that are known duplicates of canonical Web/domain records.
-- Native path completions stay because Native currently syncs aggregate word progress,
-- not learn_sessions/station_test_sessions history.
delete from public.app_usage_events
where event_type in ('path_learn_complete','path_test_complete')
  and user_id is not null
  and coalesce(platform,'web')<>'mobile';

-- Online Ashyk has a complete canonical room ledger.
delete from public.app_usage_events
where event_type='ashyk_online_complete';

alter table public.app_usage_events
  drop constraint if exists app_usage_events_event_type_check;

alter table public.app_usage_events
  add constraint app_usage_events_event_type_check
  check (event_type in (
    'path_learn_complete',
    'path_test_complete',
    'ashyk_computer_complete',
    'song_lyrics_open'
  ));

comment on table public.app_usage_events is
  'Supplementary product usage events only: Native/guest path completions plus actions without a canonical domain ledger.';

create or replace function public.record_app_usage_event(
  p_visitor_id uuid,
  p_event_type text,
  p_event_key text default null,
  p_story_type text default null,
  p_item_key text default null,
  p_platform text default 'web'
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_event_key text := nullif(btrim(coalesce(p_event_key,'')),'');
  v_story_type text := nullif(btrim(coalesce(p_story_type,'')),'');
  v_item_key text := nullif(btrim(coalesce(p_item_key,'')),'');
  v_platform text := nullif(btrim(coalesce(p_platform,'')),'');
begin
  if p_visitor_id is null then
    return false;
  end if;

  if p_event_type not in (
    'path_learn_complete',
    'path_test_complete',
    'ashyk_computer_complete',
    'song_lyrics_open'
  ) then
    raise exception 'unsupported usage event' using errcode='22023';
  end if;

  if v_platform not in ('web','mobile') then
    v_platform := null;
  end if;

  -- Web authenticated path completions are already persisted by the progress RPCs.
  if v_user_id is not null and v_platform='web' and p_event_type in ('path_learn_complete','path_test_complete') then
    return true;
  end if;
  if v_user_id is not null and v_platform is null and p_event_type in ('path_learn_complete','path_test_complete') then
    return true;
  end if;

  if p_event_type in ('path_learn_complete','path_test_complete') then
    if v_story_type not in ('understanding','roots') then
      return false;
    end if;
  else
    v_story_type := null;
  end if;

  if v_event_key is null then
    v_event_key := gen_random_uuid()::text;
  end if;

  if char_length(v_event_key)>180 or char_length(coalesce(v_item_key,''))>180 then
    return false;
  end if;

  insert into public.app_usage_events(
    event_type,event_key,visitor_id,user_id,story_type,item_key,platform,occurred_at
  )
  values(
    p_event_type,v_event_key,p_visitor_id,v_user_id,v_story_type,v_item_key,v_platform,now()
  )
  on conflict(event_type,event_key) do nothing;

  return true;
end;
$$;

revoke execute on function public.record_app_usage_event(uuid,text,text,text,text,text) from public;
grant execute on function public.record_app_usage_event(uuid,text,text,text,text,text) to anon,authenticated;

create or replace function public.admin_extended_analytics(p_period_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_days integer;
  v_today date := (now() at time zone 'UTC')::date;
  v_current_month date := date_trunc('month',(now() at time zone 'UTC'))::date;
  v_first_day date;
  v_start_date date;
  v_result jsonb;
begin
  if v_actor is null or not exists(
    select 1
    from public.profiles p
    where p.user_id=v_actor
      and p.activity_access is true
  ) then
    raise exception 'activity access denied' using errcode='42501';
  end if;

  select min((av.first_seen_at at time zone 'UTC')::date)
  into v_first_day
  from public.anonymous_visit_sessions av;

  v_days := case
    when p_period_days is null then 30
    when p_period_days<=0 then 0
    else least(greatest(p_period_days,1),3650)
  end;

  if v_days=0 then
    v_start_date := coalesce(v_first_day,v_today);
  else
    v_start_date := v_today-(v_days-1);
  end if;

  with
  visitor_accounts as (
    select
      av.visitor_id,
      case
        when count(distinct av.user_id)=1
        then (array_agg(distinct av.user_id order by av.user_id))[1]
        else null
      end as linked_user_id
    from public.anonymous_visit_sessions av
    where av.user_id is not null
    group by av.visitor_id
  ),
  visitor_day_accounts as (
    select
      av.visitor_id,
      d.day_start::date as day,
      case
        when count(distinct av.user_id)=1
        then (array_agg(distinct av.user_id order by av.user_id))[1]
        else null
      end as linked_user_id
    from public.anonymous_visit_sessions av
    cross join lateral generate_series(
      date_trunc('day',av.first_seen_at at time zone 'UTC'),
      date_trunc('day',av.last_seen_at at time zone 'UTC'),
      interval '1 day'
    ) as d(day_start)
    where av.user_id is not null
    group by av.visitor_id,d.day_start::date
  ),
  visit_days as (
    select distinct
      d.day_start::date as day,
      case
        when av.user_id is not null then 'u:'||av.user_id::text
        when va.linked_user_id is not null then 'u:'||va.linked_user_id::text
        when vda.linked_user_id is not null then 'u:'||vda.linked_user_id::text
        else 'v:'||av.visitor_id::text
      end as person_key
    from public.anonymous_visit_sessions av
    left join visitor_accounts va on va.visitor_id=av.visitor_id
    cross join lateral generate_series(
      date_trunc('day',av.first_seen_at at time zone 'UTC'),
      date_trunc('day',av.last_seen_at at time zone 'UTC'),
      interval '1 day'
    ) as d(day_start)
    left join visitor_day_accounts vda
      on vda.visitor_id=av.visitor_id
     and vda.day=d.day_start::date
  ),
  daily_counts as (
    select vd.day,count(distinct vd.person_key)::int as people
    from visit_days vd
    where vd.day>=v_start_date
      and vd.day<=v_today
    group by vd.day
  ),
  daily_series as (
    select gs::date as day
    from generate_series(v_start_date,v_today,interval '1 day') gs
  ),
  daily_json as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'date',to_char(ds.day,'YYYY-MM-DD'),
      'people',coalesce(dc.people,0)
    ) order by ds.day),'[]'::jsonb) as value
    from daily_series ds
    left join daily_counts dc on dc.day=ds.day
  ),
  period_summary as (
    select count(distinct vd.person_key)::int as unique_visitors
    from visit_days vd
    where vd.day>=v_start_date
      and vd.day<=v_today
  ),
  month_person_days as (
    select
      date_trunc('month',vd.day::timestamp)::date as month_start,
      vd.person_key,
      count(distinct vd.day)::int as active_days
    from visit_days vd
    where vd.day<v_current_month
    group by 1,2
  ),
  month_counts as (
    select
      mpd.month_start,
      count(*) filter(where mpd.active_days>=1)::int as d1,
      count(*) filter(where mpd.active_days>=3)::int as d3,
      count(*) filter(where mpd.active_days>=7)::int as d7,
      count(*) filter(where mpd.active_days>=14)::int as d14,
      count(*) filter(where mpd.active_days>=28)::int as d28
    from month_person_days mpd
    group by mpd.month_start
  ),
  month_series as (
    select gs::date as month_start
    from generate_series(
      date_trunc('month',coalesce(v_first_day,v_current_month)::timestamp),
      (v_current_month-interval '1 month')::timestamp,
      interval '1 month'
    ) gs
  ),
  monthly_json as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'month',to_char(ms.month_start,'YYYY-MM'),
      'd1',coalesce(mc.d1,0),
      'd3',coalesce(mc.d3,0),
      'd7',coalesce(mc.d7,0),
      'd14',coalesce(mc.d14,0),
      'd28',coalesce(mc.d28,0)
    ) order by ms.month_start),'[]'::jsonb) as value
    from month_series ms
    left join month_counts mc on mc.month_start=ms.month_start
  ),
  usage_people as (
    -- Web authenticated study completions: canonical persisted session rows.
    select
      date_trunc('month',ls.ended_at at time zone 'UTC')::date as month_start,
      'path_learn_complete'::text as event_type,
      cs.story_id::text as story_type,
      ls.id::text as item_key,
      'u:'||ls.user_id::text as person_key
    from public.learn_sessions ls
    join public.content_stories cs
      on ls.dictionary_id=any(cs.dictionary_ids)
    where ls.status='completed'
      and cs.story_id in ('understanding','roots')

    union all

    -- Web authenticated station tests: canonical persisted session rows.
    select
      date_trunc('month',coalesce(sts.ended_at,sts.created_at) at time zone 'UTC')::date as month_start,
      'path_test_complete'::text as event_type,
      sts.story_type,
      sts.id::text as item_key,
      'u:'||sts.user_id::text as person_key
    from public.station_test_sessions sts
    where sts.status='completed'
      and sts.story_type in ('understanding','roots')

    union all

    -- Online Ashyk is authenticated-only and ashyk_rooms is the canonical match ledger.
    select
      date_trunc('month',coalesce(r.ended_at,r.updated_at) at time zone 'UTC')::date as month_start,
      'ashyk_online_complete'::text as event_type,
      null::text as story_type,
      r.id::text as item_key,
      'u:'||p.user_id::text as person_key
    from public.ashyk_rooms r
    cross join lateral (values (r.host_user_id),(r.guest_user_id)) as p(user_id)
    where r.status='finished'
      and p.user_id is not null

    union all

    -- app_usage_events is supplementary only:
    -- 1) Native path completions (Native does not persist session history in the cloud);
    -- 2) Web guest path completions until/unless the guest session is claimed;
    -- 3) computer Ashyk and song lyric opens, which have no canonical domain ledger.
    select
      date_trunc('month',ue.occurred_at at time zone 'UTC')::date as month_start,
      ue.event_type,
      ue.story_type,
      ue.item_key,
      case
        when ue.user_id is not null then 'u:'||ue.user_id::text
        when va.linked_user_id is not null then 'u:'||va.linked_user_id::text
        when vda.linked_user_id is not null then 'u:'||vda.linked_user_id::text
        when ue.visitor_id is not null then 'v:'||ue.visitor_id::text
        else 'event:'||ue.id::text
      end as person_key
    from public.app_usage_events ue
    left join visitor_accounts va on va.visitor_id=ue.visitor_id
    left join visitor_day_accounts vda
      on vda.visitor_id=ue.visitor_id
     and vda.day=(ue.occurred_at at time zone 'UTC')::date
    where ue.event_type in ('path_learn_complete','path_test_complete','ashyk_computer_complete','song_lyrics_open')
      and (
        ue.event_type in ('ashyk_computer_complete','song_lyrics_open')
        or ue.platform='mobile'
        or ue.user_id is null
      )
      and (
        ue.event_type<>'path_learn_complete'
        or not exists (
          select 1
          from public.learn_sessions claimed_learn
          where claimed_learn.id::text=ue.item_key
            and claimed_learn.status='completed'
        )
      )
      and (
        ue.event_type<>'path_test_complete'
        or not exists (
          select 1
          from public.station_test_sessions claimed_test
          where claimed_test.id::text=ue.item_key
            and claimed_test.status='completed'
        )
      )
  ),
  usage_agg as (
    select
      up.month_start,
      up.event_type,
      up.story_type,
      count(distinct up.person_key)::int as people,
      case
        when up.event_type='ashyk_online_complete'
        then count(distinct up.item_key)::int
        else count(*)::int
      end as actions
    from usage_people up
    group by up.month_start,up.event_type,up.story_type
  ),
  usage_bounds as (
    select min(up.month_start) as first_month
    from usage_people up
  ),
  usage_series as (
    select gs::date as month_start
    from usage_bounds ub
    cross join lateral generate_series(
      coalesce(ub.first_month,v_current_month)::timestamp,
      v_current_month::timestamp,
      interval '1 month'
    ) gs
  ),
  usage_by_month as (
    select us.month_start,
      jsonb_build_object(
      'month',to_char(us.month_start,'YYYY-MM'),
      'understanding_learn',jsonb_build_object(
        'people',coalesce(max(ua.people) filter(
          where ua.event_type='path_learn_complete'
            and ua.story_type='understanding'
        ),0),
        'actions',coalesce(max(ua.actions) filter(
          where ua.event_type='path_learn_complete'
            and ua.story_type='understanding'
        ),0)
      ),
      'understanding_test',jsonb_build_object(
        'people',coalesce(max(ua.people) filter(
          where ua.event_type='path_test_complete'
            and ua.story_type='understanding'
        ),0),
        'actions',coalesce(max(ua.actions) filter(
          where ua.event_type='path_test_complete'
            and ua.story_type='understanding'
        ),0)
      ),
      'roots_learn',jsonb_build_object(
        'people',coalesce(max(ua.people) filter(
          where ua.event_type='path_learn_complete'
            and ua.story_type='roots'
        ),0),
        'actions',coalesce(max(ua.actions) filter(
          where ua.event_type='path_learn_complete'
            and ua.story_type='roots'
        ),0)
      ),
      'roots_test',jsonb_build_object(
        'people',coalesce(max(ua.people) filter(
          where ua.event_type='path_test_complete'
            and ua.story_type='roots'
        ),0),
        'actions',coalesce(max(ua.actions) filter(
          where ua.event_type='path_test_complete'
            and ua.story_type='roots'
        ),0)
      ),
      'ashyk_computer',jsonb_build_object(
        'people',coalesce(max(ua.people) filter(
          where ua.event_type='ashyk_computer_complete'
        ),0),
        'actions',coalesce(max(ua.actions) filter(
          where ua.event_type='ashyk_computer_complete'
        ),0)
      ),
      'ashyk_online',jsonb_build_object(
        'people',coalesce(max(ua.people) filter(
          where ua.event_type='ashyk_online_complete'
        ),0),
        'actions',coalesce(max(ua.actions) filter(
          where ua.event_type='ashyk_online_complete'
        ),0)
      ),
      'song_lyrics',jsonb_build_object(
        'people',coalesce(max(ua.people) filter(
          where ua.event_type='song_lyrics_open'
        ),0),
        'actions',coalesce(max(ua.actions) filter(
          where ua.event_type='song_lyrics_open'
        ),0)
      )
    ) as value
    from usage_series us
    left join usage_agg ua on ua.month_start=us.month_start
    group by us.month_start
  ),
  usage_months as (
    select coalesce(jsonb_agg(ubm.value order by ubm.month_start),'[]'::jsonb) as value
    from usage_by_month ubm
  )
  select jsonb_build_object(
    'period_days',v_days,
    'summary',jsonb_build_object(
      'unique_visitors',coalesce(ps.unique_visitors,0),
      'from',to_char(v_start_date,'YYYY-MM-DD'),
      'to',to_char(v_today,'YYYY-MM-DD')
    ),
    'daily_visitors',dj.value,
    'monthly_visitors',mj.value,
    'usage_months',um.value
  )
  into v_result
  from period_summary ps
  cross join daily_json dj
  cross join monthly_json mj
  cross join usage_months um;

  return coalesce(v_result,jsonb_build_object(
    'period_days',v_days,
    'summary',jsonb_build_object('unique_visitors',0),
    'daily_visitors','[]'::jsonb,
    'monthly_visitors','[]'::jsonb,
    'usage_months','[]'::jsonb
  ));
end;
$$;

revoke execute on function public.admin_extended_analytics(integer) from public,anon;
grant execute on function public.admin_extended_analytics(integer) to authenticated;

commit;

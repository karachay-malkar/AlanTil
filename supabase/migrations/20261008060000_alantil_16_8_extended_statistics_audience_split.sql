begin;

-- Split authenticated users and guests at the source of every extended-statistics metric.
-- started_as_guest preserves the immutable origin of historical visit sessions. A session
-- that began as a guest and later received user_id proves both a guest and an authenticated
-- presence; current Web/Mobile clients now start a fresh visit session on auth-scope changes.

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
  visit_days as (
    select distinct
      d.day_start::date as day,
      'guests'::text as audience,
      'v:'||av.visitor_id::text as person_key
    from public.anonymous_visit_sessions av
    cross join lateral generate_series(
      date_trunc('day',av.first_seen_at at time zone 'UTC'),
      date_trunc('day',av.last_seen_at at time zone 'UTC'),
      interval '1 day'
    ) as d(day_start)
    where av.started_as_guest is true
       or (av.started_as_guest is null and av.user_id is null)

    union all

    select distinct
      d.day_start::date as day,
      'authorized'::text as audience,
      'u:'||av.user_id::text as person_key
    from public.anonymous_visit_sessions av
    cross join lateral generate_series(
      date_trunc('day',av.first_seen_at at time zone 'UTC'),
      date_trunc('day',av.last_seen_at at time zone 'UTC'),
      interval '1 day'
    ) as d(day_start)
    where av.user_id is not null
  ),
  daily_counts as (
    select
      vd.day,
      count(distinct vd.person_key) filter(where vd.audience='authorized')::int as authorized,
      count(distinct vd.person_key) filter(where vd.audience='guests')::int as guests
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
      'authorized',coalesce(dc.authorized,0),
      'guests',coalesce(dc.guests,0)
    ) order by ds.day),'[]'::jsonb) as value
    from daily_series ds
    left join daily_counts dc on dc.day=ds.day
  ),
  period_summary as (
    select
      count(distinct vd.person_key) filter(where vd.audience='authorized')::int as authorized,
      count(distinct vd.person_key) filter(where vd.audience='guests')::int as guests
    from visit_days vd
    where vd.day>=v_start_date
      and vd.day<=v_today
  ),
  month_person_days as (
    select
      date_trunc('month',vd.day::timestamp)::date as month_start,
      vd.audience,
      vd.person_key,
      count(distinct vd.day)::int as active_days
    from visit_days vd
    where vd.day<v_current_month
    group by 1,2,3
  ),
  month_counts as (
    select
      mpd.month_start,
      count(*) filter(where mpd.audience='authorized' and mpd.active_days>=1)::int as authorized_d1,
      count(*) filter(where mpd.audience='authorized' and mpd.active_days>=3)::int as authorized_d3,
      count(*) filter(where mpd.audience='authorized' and mpd.active_days>=7)::int as authorized_d7,
      count(*) filter(where mpd.audience='authorized' and mpd.active_days>=14)::int as authorized_d14,
      count(*) filter(where mpd.audience='authorized' and mpd.active_days>=28)::int as authorized_d28,
      count(*) filter(where mpd.audience='guests' and mpd.active_days>=1)::int as guests_d1,
      count(*) filter(where mpd.audience='guests' and mpd.active_days>=3)::int as guests_d3,
      count(*) filter(where mpd.audience='guests' and mpd.active_days>=7)::int as guests_d7,
      count(*) filter(where mpd.audience='guests' and mpd.active_days>=14)::int as guests_d14,
      count(*) filter(where mpd.audience='guests' and mpd.active_days>=28)::int as guests_d28
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
      'authorized',jsonb_build_object(
        'd1',coalesce(mc.authorized_d1,0),
        'd3',coalesce(mc.authorized_d3,0),
        'd7',coalesce(mc.authorized_d7,0),
        'd14',coalesce(mc.authorized_d14,0),
        'd28',coalesce(mc.authorized_d28,0)
      ),
      'guests',jsonb_build_object(
        'd1',coalesce(mc.guests_d1,0),
        'd3',coalesce(mc.guests_d3,0),
        'd7',coalesce(mc.guests_d7,0),
        'd14',coalesce(mc.guests_d14,0),
        'd28',coalesce(mc.guests_d28,0)
      )
    ) order by ms.month_start),'[]'::jsonb) as value
    from month_series ms
    left join month_counts mc on mc.month_start=ms.month_start
  ),
  path_sets as (
    select distinct
      cw.story_id,
      cw.dictionary_id,
      cw.section_id,
      cw.set_id
    from public.content_words cw
    where cw.story_id in ('understanding','roots')
      and cw.dictionary_id is not null
      and cw.section_id is not null
      and cw.set_id is not null
  ),
  usage_people as (
    select
      date_trunc('month',ls.ended_at at time zone 'UTC')::date as month_start,
      'path_learn_complete'::text as event_type,
      ps.story_id::text as story_type,
      ls.id::text as item_key,
      'authorized'::text as audience,
      'u:'||ls.user_id::text as person_key
    from public.learn_sessions ls
    join path_sets ps
      on ps.dictionary_id=ls.dictionary_id
     and ps.section_id=ls.section_id
     and ps.set_id=ls.set_id
    where ls.status='completed'

    union all

    select
      date_trunc('month',sts.ended_at at time zone 'UTC')::date as month_start,
      'path_test_complete'::text as event_type,
      ps.story_id::text as story_type,
      sts.id::text as item_key,
      'authorized'::text as audience,
      'u:'||sts.user_id::text as person_key
    from public.station_test_sessions sts
    join path_sets ps
      on ps.story_id=sts.story_type
     and ps.dictionary_id=sts.dictionary_id
     and ps.section_id=sts.group_id
     and ps.set_id=sts.set_id
    where sts.status='completed'

    union all

    select
      date_trunc('month',coalesce(r.ended_at,r.updated_at) at time zone 'UTC')::date as month_start,
      'ashyk_online_complete'::text as event_type,
      null::text as story_type,
      r.id::text as item_key,
      'authorized'::text as audience,
      'u:'||p.user_id::text as person_key
    from public.ashyk_rooms r
    cross join lateral (values (r.host_user_id),(r.guest_user_id)) as p(user_id)
    where r.status='finished'
      and r.finish_reason in ('score','kyt')
      and r.guest_user_id is not null
      and p.user_id is not null

    union all

    select
      date_trunc('month',ue.occurred_at at time zone 'UTC')::date as month_start,
      ue.event_type,
      case
        when ue.event_type in ('path_learn_complete','path_test_complete') then ps.story_id
        else ue.story_type
      end as story_type,
      ue.item_key,
      case when ue.user_id is not null then 'authorized' else 'guests' end as audience,
      case
        when ue.user_id is not null then 'u:'||ue.user_id::text
        when ue.visitor_id is not null then 'v:'||ue.visitor_id::text
        else 'event:'||ue.id::text
      end as person_key
    from public.app_usage_events ue
    left join path_sets ps
      on ue.event_type in ('path_learn_complete','path_test_complete')
     and ue.story_type=ps.story_id
     and ue.dictionary_id=ps.dictionary_id
     and ue.section_id=ps.section_id
     and ue.set_id=ps.set_id
    where ue.event_type in ('path_learn_complete','path_test_complete','ashyk_computer_complete','song_lyrics_open')
      and (
        ue.event_type in ('ashyk_computer_complete','song_lyrics_open')
        or ps.story_id is not null
      )
      and (
        ue.event_type<>'ashyk_computer_complete'
        or ue.item_key in ('score','kyt')
      )
      and (
        ue.event_type<>'song_lyrics_open'
        or (
          exists (
            select 1 from public.songs s
            where s.id=ue.item_key and s.is_published is true
          )
          and exists (
            select 1 from public.song_lines sl
            where sl.song_id=ue.item_key
          )
        )
      )
      and (
        ue.event_type<>'path_learn_complete'
        or not exists (
          select 1 from public.learn_sessions claimed_learn
          where claimed_learn.id::text=ue.item_key
            and claimed_learn.status='completed'
        )
      )
      and (
        ue.event_type<>'path_test_complete'
        or not exists (
          select 1 from public.station_test_sessions claimed_test
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
      up.audience,
      count(distinct up.person_key)::int as people,
      case
        when up.event_type='ashyk_online_complete'
        then count(distinct up.item_key)::int
        else count(*)::int
      end as actions
    from usage_people up
    group by up.month_start,up.event_type,up.story_type,up.audience
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
  usage_metric_defs(metric_key,event_type,story_type) as (
    values
      ('understanding_learn'::text,'path_learn_complete'::text,'understanding'::text),
      ('understanding_test','path_test_complete','understanding'),
      ('roots_learn','path_learn_complete','roots'),
      ('roots_test','path_test_complete','roots'),
      ('ashyk_computer','ashyk_computer_complete',null::text),
      ('ashyk_online','ashyk_online_complete',null::text),
      ('song_lyrics','song_lyrics_open',null::text)
  ),
  usage_audiences(audience) as (
    values ('authorized'::text),('guests'::text)
  ),
  usage_grid as (
    select
      us.month_start,
      md.metric_key,
      a.audience,
      coalesce(ua.people,0)::int as people,
      coalesce(ua.actions,0)::int as actions
    from usage_series us
    cross join usage_metric_defs md
    cross join usage_audiences a
    left join usage_agg ua
      on ua.month_start=us.month_start
     and ua.event_type=md.event_type
     and ua.story_type is not distinct from md.story_type
     and ua.audience=a.audience
  ),
  usage_metric_json as (
    select
      ug.month_start,
      ug.metric_key,
      jsonb_build_object(
        'authorized',jsonb_build_object(
          'people',coalesce(max(ug.people) filter(where ug.audience='authorized'),0),
          'actions',coalesce(max(ug.actions) filter(where ug.audience='authorized'),0)
        ),
        'guests',jsonb_build_object(
          'people',coalesce(max(ug.people) filter(where ug.audience='guests'),0),
          'actions',coalesce(max(ug.actions) filter(where ug.audience='guests'),0)
        )
      ) as value
    from usage_grid ug
    group by ug.month_start,ug.metric_key
  ),
  usage_by_month as (
    select
      umj.month_start,
      jsonb_build_object('month',to_char(umj.month_start,'YYYY-MM'))
        || jsonb_object_agg(umj.metric_key,umj.value) as value
    from usage_metric_json umj
    group by umj.month_start
  ),
  usage_months as (
    select coalesce(jsonb_agg(ubm.value order by ubm.month_start),'[]'::jsonb) as value
    from usage_by_month ubm
  )
  select jsonb_build_object(
    'period_days',v_days,
    'summary',jsonb_build_object(
      'authorized',coalesce(ps.authorized,0),
      'guests',coalesce(ps.guests,0),
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
    'summary',jsonb_build_object('authorized',0,'guests',0),
    'daily_visitors','[]'::jsonb,
    'monthly_visitors','[]'::jsonb,
    'usage_months','[]'::jsonb
  ));
end;
$$;

revoke execute on function public.admin_extended_analytics(integer) from public,anon;
grant execute on function public.admin_extended_analytics(integer) to authenticated;

commit;

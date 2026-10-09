-- Restricted admin-only chronological history of completed study and station-test sessions.
create or replace function public.admin_user_study_history(p_user_id uuid, p_limit integer default 5000)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.activity_access is true
  ) then
    raise exception 'activity access denied' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(to_jsonb(h) order by h.event_at desc, h.session_id), '[]'::jsonb)
  into result
  from (
    select 'learn'::text as event_type, l.id as session_id, l.ended_at as event_at,
      case l.dictionary_id when 'beginner' then 'understanding'
        when 'intermediate' then 'roots' when 'advanced' then 'ascent'
        when 'thematic' then 'pathways' else l.dictionary_id end as story_type,
      l.set_id, coalesce(nullif(cs.name_ru,''),nullif(cs.name_alan_cyrillic,''),l.set_id) as set_name,
      null::numeric as accuracy,
      round(l.card_shows_total::numeric / nullif(l.unique_words_shown,0),2) as shows_per_word
    from public.learn_sessions l
    left join public.content_structure cs on cs.entity_type='set' and cs.entity_id=l.set_id
    where l.user_id=p_user_id and l.status='completed' and l.ended_at is not null
    union all
    select 'test'::text as event_type, t.id as session_id, t.ended_at as event_at,
      t.story_type, t.set_id, coalesce(nullif(cs.name_ru,''),nullif(cs.name_alan_cyrillic,''),t.set_id) as set_name,
      t.accuracy::numeric as accuracy, null::numeric as shows_per_word
    from public.station_test_sessions t
    left join public.content_structure cs on cs.entity_type='set' and cs.entity_id=t.set_id
    where t.user_id=p_user_id and t.status='completed' and t.ended_at is not null
    order by event_at desc
    limit least(greatest(coalesce(p_limit,5000),1),5000)
  ) h;
  return result;
end;
$$;
revoke all on function public.admin_user_study_history(uuid,integer) from public, anon;
grant execute on function public.admin_user_study_history(uuid,integer) to authenticated;

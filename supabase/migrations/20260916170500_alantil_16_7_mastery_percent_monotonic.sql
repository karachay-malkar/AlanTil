begin;

create or replace function private.apply_mastery_percent()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_best numeric:=0;
  v_previous numeric:=0;
begin
  if tg_op='UPDATE' then
    v_previous:=coalesce(old.mastery_percent,0);
  end if;

  select coalesce(max(s.accuracy),0) into v_best
  from public.station_test_session_words sw
  join public.station_test_sessions s on s.id=sw.session_id and s.user_id=sw.user_id
  where sw.user_id=new.user_id
    and sw.word_id=new.word_id
    and sw.result='correct'
    and s.status='completed'
    and coalesce(s.accuracy,0)>=80;

  new.mastery_percent:=least(
    100,
    greatest(
      coalesce(new.mastery_percent,0),
      v_previous,
      v_best,
      case when new.mastery_status in ('mastered','review') then 80 else 0 end
    )
  );
  return new;
end $$;

commit;

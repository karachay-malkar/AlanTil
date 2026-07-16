-- Keep exposed RPCs SECURITY INVOKER and move privileged implementations out
-- of the Data API schema. This preserves the authenticated RPC contract while
-- preventing direct table writes.

begin;

do $move_implementations$
begin
  if to_regprocedure('private.save_learn_session(jsonb)') is null then
    alter function public.save_learn_session(jsonb) set schema private;
  end if;
  if to_regprocedure('private.save_test_session(jsonb)') is null then
    alter function public.save_test_session(jsonb) set schema private;
  end if;
  if to_regprocedure('private.save_station_test_session(jsonb)') is null then
    alter function public.save_station_test_session(jsonb) set schema private;
  end if;
  if to_regprocedure('private.save_match_session(jsonb)') is null then
    alter function public.save_match_session(jsonb) set schema private;
  end if;
  if to_regprocedure('private.merge_word_progress_snapshot(jsonb)') is null then
    alter function public.merge_word_progress_snapshot(jsonb) set schema private;
  end if;
end
$move_implementations$;

create or replace function public.save_learn_session(payload jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $wrapper$
  select private.save_learn_session(payload);
$wrapper$;

create or replace function public.save_test_session(payload jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $wrapper$
  select private.save_test_session(payload);
$wrapper$;

create or replace function public.save_station_test_session(payload jsonb)
returns uuid
language sql
security invoker
set search_path = ''
as $wrapper$
  select private.save_station_test_session(payload);
$wrapper$;

create or replace function public.save_match_session(payload jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $wrapper$
  select private.save_match_session(payload);
$wrapper$;

create or replace function public.merge_word_progress_snapshot(payload jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $wrapper$
  select private.merge_word_progress_snapshot(payload);
$wrapper$;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

revoke all on function private.save_learn_session(jsonb) from public, anon;
revoke all on function private.save_test_session(jsonb) from public, anon;
revoke all on function private.save_station_test_session(jsonb) from public, anon;
revoke all on function private.save_match_session(jsonb) from public, anon;
revoke all on function private.merge_word_progress_snapshot(jsonb) from public, anon;

grant execute on function private.save_learn_session(jsonb) to authenticated, service_role;
grant execute on function private.save_test_session(jsonb) to authenticated, service_role;
grant execute on function private.save_station_test_session(jsonb) to authenticated, service_role;
grant execute on function private.save_match_session(jsonb) to authenticated, service_role;
grant execute on function private.merge_word_progress_snapshot(jsonb) to authenticated, service_role;

revoke all on function public.save_learn_session(jsonb) from public, anon;
revoke all on function public.save_test_session(jsonb) from public, anon;
revoke all on function public.save_station_test_session(jsonb) from public, anon;
revoke all on function public.save_match_session(jsonb) from public, anon;
revoke all on function public.merge_word_progress_snapshot(jsonb) from public, anon;

grant execute on function public.save_learn_session(jsonb) to authenticated, service_role;
grant execute on function public.save_test_session(jsonb) to authenticated, service_role;
grant execute on function public.save_station_test_session(jsonb) to authenticated, service_role;
grant execute on function public.save_match_session(jsonb) to authenticated, service_role;
grant execute on function public.merge_word_progress_snapshot(jsonb) to authenticated, service_role;

drop policy if exists word_progress_snapshot_receipts_deny_direct on private.word_progress_snapshot_receipts;
create policy word_progress_snapshot_receipts_deny_direct
  on private.word_progress_snapshot_receipts
  for all to authenticated
  using (false)
  with check (false);

notify pgrst, 'reload schema';

commit;

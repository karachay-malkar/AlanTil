begin;
create index if not exists ashyk_action_log_actor_user_id_idx on public.ashyk_action_log(actor_user_id);
create index if not exists ashyk_rooms_last_action_actor_user_id_idx on public.ashyk_rooms(last_action_actor_user_id);
create index if not exists ashyk_rooms_winner_user_id_idx on public.ashyk_rooms(winner_user_id);
drop policy if exists ashyk_action_log_members_read on public.ashyk_action_log;
create policy ashyk_action_log_members_read on public.ashyk_action_log
for select to authenticated
using(exists(
  select 1
  from public.ashyk_rooms r
  where r.id=room_id
    and ((select auth.uid())=r.host_user_id or (select auth.uid())=r.guest_user_id)
));
commit;

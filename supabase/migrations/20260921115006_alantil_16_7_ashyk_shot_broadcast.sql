begin;
drop policy if exists ashyk_shot_broadcast_receive on realtime.messages;
create policy ashyk_shot_broadcast_receive
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension='broadcast'
  and exists (
    select 1
    from public.ashyk_rooms r
    where ('ashyk-shot:'||r.id::text)=(select realtime.topic())
      and r.status='playing'
      and ((select auth.uid())=r.host_user_id or (select auth.uid())=r.guest_user_id)
  )
);
drop policy if exists ashyk_shot_broadcast_send on realtime.messages;
create policy ashyk_shot_broadcast_send
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension='broadcast'
  and exists (
    select 1
    from public.ashyk_rooms r
    where ('ashyk-shot:'||r.id::text)=(select realtime.topic())
      and r.status='playing'
      and r.active_user_id=(select auth.uid())
  )
);
commit;

begin;

create index if not exists ashyk_invites_host_user_idx
  on public.ashyk_invites(host_user_id);
create index if not exists ashyk_invites_room_idx
  on public.ashyk_invites(room_id);
create index if not exists user_blocks_blocked_idx
  on public.user_blocks(blocked_id);
create index if not exists ashyk_rooms_host_user_idx
  on public.ashyk_rooms(host_user_id);
create index if not exists ashyk_rooms_guest_user_idx
  on public.ashyk_rooms(guest_user_id);
create index if not exists ashyk_rooms_active_user_idx
  on public.ashyk_rooms(active_user_id);

drop policy if exists friendships_members_read on public.friendships;
create policy friendships_members_read
  on public.friendships
  for select
  to authenticated
  using(
    (select auth.uid())=requester_id
    or (select auth.uid())=addressee_id
  );

drop policy if exists user_blocks_owner_read on public.user_blocks;
create policy user_blocks_owner_read
  on public.user_blocks
  for select
  to authenticated
  using((select auth.uid())=blocker_id);

drop policy if exists ashyk_invites_members_read on public.ashyk_invites;
create policy ashyk_invites_members_read
  on public.ashyk_invites
  for select
  to authenticated
  using(
    (select auth.uid())=host_user_id
    or (select auth.uid())=friend_user_id
  );

commit;

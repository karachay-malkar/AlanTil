begin;
drop trigger if exists profiles_identity_update_guard on public.profiles;
drop function if exists private.guard_profile_identity_update();
commit;

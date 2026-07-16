-- v_words_app is a read-only application contract.

begin;

revoke all on public.v_words_app from public, anon, authenticated;
grant select on public.v_words_app to anon, authenticated, service_role;

commit;

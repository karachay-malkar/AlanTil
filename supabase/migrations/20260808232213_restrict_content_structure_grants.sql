begin;
revoke all privileges on table public.content_structure from anon, authenticated;
grant select on table public.content_structure to anon, authenticated;
commit;

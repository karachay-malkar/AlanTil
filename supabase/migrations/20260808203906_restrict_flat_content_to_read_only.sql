begin;

revoke all privileges on table public.content_words from anon, authenticated;
revoke all privileges on table public.content_stories from anon, authenticated;
grant select on table public.content_words to anon, authenticated;
grant select on table public.content_stories to anon, authenticated;

commit;

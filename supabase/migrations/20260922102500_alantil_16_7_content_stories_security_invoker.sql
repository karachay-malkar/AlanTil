begin;

alter view public.content_stories set (security_invoker = true);

do $validation$
begin
  if coalesce((
    select (c.reloptions @> array['security_invoker=true']::text[])
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'content_stories'
  ), false) is not true then
    raise exception 'content_stories must use security_invoker';
  end if;
end
$validation$;

notify pgrst, 'reload schema';
commit;

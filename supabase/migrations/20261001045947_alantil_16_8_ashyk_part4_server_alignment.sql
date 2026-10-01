create or replace function private.ashyk_phase_seconds(p_state jsonb,p_phase text)
returns integer
language sql
immutable
set search_path=''
as $$
  select case when p_phase='bonus-question' then 15 else 20 end
$$;

revoke all on function public.ashyk_players_snapshot() from public, anon;
grant execute on function public.ashyk_players_snapshot() to authenticated;

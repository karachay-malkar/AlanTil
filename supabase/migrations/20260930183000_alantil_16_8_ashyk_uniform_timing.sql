create or replace function private.ashyk_phase_seconds(p_state jsonb,p_phase text)
returns integer
language sql
immutable
set search_path=''
as $$
  select case when p_phase='bonus-question' then 15 else 20 end
$$;

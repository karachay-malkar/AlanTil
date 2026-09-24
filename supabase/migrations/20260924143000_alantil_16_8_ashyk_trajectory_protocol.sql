begin;

alter table public.ashyk_rooms alter column protocol_version set default 3;

create or replace function private.ashyk_enforce_protocol_v3()
returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='INSERT' then
    if new.protocol_version is null or new.protocol_version=2 then new.protocol_version:=3; end if;
  elsif old.protocol_version=3 and new.protocol_version=2 then
    new.protocol_version:=3;
  end if;
  return new;
end;
$$;

drop trigger if exists ashyk_rooms_protocol_v3_guard on public.ashyk_rooms;
create trigger ashyk_rooms_protocol_v3_guard
before insert or update of protocol_version on public.ashyk_rooms
for each row execute function private.ashyk_enforce_protocol_v3();

commit;

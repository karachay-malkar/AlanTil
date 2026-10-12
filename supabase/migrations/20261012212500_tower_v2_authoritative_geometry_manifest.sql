-- Tower V2 Stage 6: read-only canonical triangles for the exact saved revision.
-- No change to mutate_tower_v2, V1 towers, balances, stored geometry or RLS.
-- This endpoint provides a physical-source attestation; derived display fitting
-- and gap pebbles remain NON-load-bearing and are never persisted as elements.
create or replace function private.get_tower_v2_geometry(p_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  viewer uuid:=auth.uid();
  target uuid:=coalesce(p_user_id,auth.uid());
  rev bigint;
  item record;
  geometry jsonb;
  bodies jsonb:='[]'::jsonb;
begin
  if viewer is null then raise exception 'AUTH_REQUIRED';end if;
  select revision into rev from private.tower_accounts where user_id=target;
  for item in select id,data from private.tower_v2_elements
    where user_id=target order by created_at,id
  loop
    geometry:=private.tower_v2_body(item.data);
    bodies:=bodies||jsonb_build_array(jsonb_build_object(
      'id',item.id,'v',geometry->'v','f',geometry->'f'));
  end loop;
  return jsonb_build_object('format',2,'geometryVersion',1,
    'revision',coalesce(rev,0),'bodies',bodies);
end $$;

create or replace function public.get_tower_v2_geometry(p_user_id uuid default null)
returns jsonb language sql security invoker set search_path='' as $$
  select private.get_tower_v2_geometry(p_user_id)
$$;

revoke all on function private.get_tower_v2_geometry(uuid),
  public.get_tower_v2_geometry(uuid) from public,anon;
grant execute on function private.get_tower_v2_geometry(uuid),
  public.get_tower_v2_geometry(uuid) to authenticated;

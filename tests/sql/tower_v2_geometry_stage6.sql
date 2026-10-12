\set ON_ERROR_STOP on
-- This CI-only fixture follows tower_v2_integration.sql and does not modify
-- application state. It exercises the real PostgreSQL-authored 50-stone tower.
set role authenticated;
set "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000003';
DO $$
declare manifest jsonb;first jsonb;
begin
 manifest:=public.get_tower_v2_geometry(null);
 if manifest->>'format'<>'2' or manifest->>'geometryVersion'<>'1' or
    manifest->>'revision'<>'50' or jsonb_array_length(manifest->'bodies')<>50 then
   raise exception 'GEOMETRY_MANIFEST_REVISION_OR_COUNT %',manifest->>'revision';
 end if;
 first:=manifest->'bodies'->0;
 if jsonb_array_length(first->'v')<20 or jsonb_array_length(first->'f')<20 then
   raise exception 'INCOMPLETE_AUTHORED_BODY';
 end if;
 if jsonb_typeof(first->'v'->0->0)<>'number' or jsonb_typeof(first->'f'->0->0)<>'number' then
   raise exception 'INVALID_AUTHORED_TRIANGLES';
 end if;
end $$;
reset role;
DO $$
begin
 if has_function_privilege('anon','public.get_tower_v2_geometry(uuid)','execute') then
  raise exception 'ANON_CAN_READ_PRIVATE_GEOMETRY';
 end if;
 if not has_function_privilege('authenticated','public.get_tower_v2_geometry(uuid)','execute') then
  raise exception 'AUTHENTICATED_CANNOT_READ_GEOMETRY';
 end if;
end $$;
\echo TOWER_V2_GEOMETRY_MANIFEST_STAGE6_OK

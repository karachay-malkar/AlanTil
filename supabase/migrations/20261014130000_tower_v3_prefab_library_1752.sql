-- AlanTil 17.5.2: three new variants per type. Historical v17.5.0/17.5.1
-- eight-variant purchases are unchanged and remain loadable.
-- No wallet mutation, no history deletion, no revisions reset.
alter table private.tower_v3_sections
 drop constraint if exists tower_v3_sections_geometry_version_check;
alter table private.tower_v3_sections
 add constraint tower_v3_sections_geometry_version_check
 check (geometry_version in ('17.5.0','17.5.1','17.5.2'));
alter table private.tower_v3_sections
 add constraint tower_v3_sections_latest_variant_check
 check (geometry_version <> '17.5.2' or variant_id between 0 and 2);

create or replace function private.tower_v3_canonical(e jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare typ text;v int;r int;px int;py int;pz int;dims int[];uid uuid;
begin
 if e is null or jsonb_typeof(e)<>'object' then raise exception 'INVALID_V3_SECTION';end if;
 if (e->>'id') is null or (e->>'sectionId') is null or (e->>'geometryVersion') is null or
    (e->>'variant') is null or (e->>'rotation') is null or (e->>'x') is null or (e->>'y') is null or (e->>'z') is null then
  raise exception 'INVALID_V3_SECTION';end if;
 if (e->>'variant') !~ '^[0-9]+$' or (e->>'rotation') !~ '^[0-9]+$' or
    (e->>'x') !~ '^[0-9]+$' or (e->>'y') !~ '^[0-9]+$' or (e->>'z') !~ '^[0-9]+$' then raise exception 'GRID_REQUIRED';end if;
 uid:=(e->>'id')::uuid;typ:=e->>'sectionId';v:=(e->>'variant')::int;r:=(e->>'rotation')::int;
 px:=(e->>'x')::int;py:=(e->>'y')::int;pz:=(e->>'z')::int;
 dims:=private.tower_v3_size(typ,r);
 if uid is null or dims is null or (v not between 0 and 7 or (e->>'geometryVersion'='17.5.2' and v>2)) or r not between 0 and 3 or
   e->>'geometryVersion' not in ('17.5.0','17.5.1','17.5.2') or px+ dims[1]>60 or py+dims[2]>80 or pz+dims[3]>60 then
  raise exception 'INVALID_V3_SECTION';end if;
 return jsonb_build_object('id',uid,'type','masonry_section','sectionId',typ,'variant',v,
   'rotation',r,'x',px,'y',py,'z',pz,'geometryVersion',e->>'geometryVersion');
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'INVALID_V3_SECTION';
end $$;
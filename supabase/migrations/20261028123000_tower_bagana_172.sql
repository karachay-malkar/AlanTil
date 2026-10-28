-- Additive tower timber support post. Existing approved stone and opening IDs are unchanged.
-- Match the 15x30m V3 canonical validation in 20261025160000_tower_parcel_15x30.sql.
ALTER TABLE private.tower_v3_sections DROP CONSTRAINT IF EXISTS tower_v3_sections_section_id_check;
ALTER TABLE private.tower_v3_sections ADD CONSTRAINT tower_v3_sections_section_id_check
 CHECK(section_id IN ('1x1x1','2x2x2','2x2x3','2x3x4','4x4x4','window-4x5x2','door-7x9x2','gate-18x10x2','3x3x3','bagana-2x10x2'));
ALTER TABLE private.tower_v3_sections DROP CONSTRAINT IF EXISTS tower_v3_sections_geometry_version_check;
ALTER TABLE private.tower_v3_sections ADD CONSTRAINT tower_v3_sections_geometry_version_check
 CHECK(geometry_version IN ('17.5.0','17.5.1','17.5.2','17.6-window.1','17.6-door.1','17.5.3','17.6-gate.1','17.5.4','17.5.5','17.7-approved-manual.1','17.2-bagana.1'));
CREATE OR REPLACE FUNCTION private.tower_v3_size(p_type text, p_rotation integer)
 RETURNS integer[] LANGUAGE sql IMMUTABLE SET search_path TO ''
AS $function$
SELECT CASE p_type
 WHEN '1x1x1' THEN ARRAY[1,1,1]
 WHEN '2x2x2' THEN ARRAY[2,2,2]
 WHEN '2x3x4' THEN CASE WHEN p_rotation%2=1 THEN ARRAY[4,3,2] ELSE ARRAY[2,3,4] END
 WHEN '3x3x3' THEN ARRAY[3,3,3]
 WHEN 'window-4x5x2' THEN CASE WHEN p_rotation%2=1 THEN ARRAY[2,5,4] ELSE ARRAY[4,5,2] END
 WHEN 'door-7x9x2' THEN CASE WHEN p_rotation%2=1 THEN ARRAY[2,9,7] ELSE ARRAY[7,9,2] END
 WHEN 'gate-18x10x2' THEN CASE WHEN p_rotation%2=1 THEN ARRAY[2,10,18] ELSE ARRAY[18,10,2] END
 WHEN 'bagana-2x10x2' THEN ARRAY[2,10,2]
 ELSE NULL::integer[] END
$function$;
CREATE OR REPLACE FUNCTION private.tower_v3_canonical(e jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
DECLARE typ text;v int;r int;px int;py int;pz int;dims int[];uid uuid;version text;valid boolean;
BEGIN
 IF e IS NULL OR jsonb_typeof(e)<>'object' OR
 (e->>'id') IS NULL OR (e->>'sectionId') IS NULL OR (e->>'geometryVersion') IS NULL OR
 (e->>'variant') IS NULL OR (e->>'rotation') IS NULL OR
 (e->>'x') IS NULL OR (e->>'y') IS NULL OR (e->>'z') IS NULL THEN RAISE EXCEPTION 'INVALID_V3_SECTION'; END IF;
 IF (e->>'variant') !~ '^[0-9]+$' OR (e->>'rotation') !~ '^[0-9]+$' OR
 (e->>'x') !~ '^[0-9]+$' OR (e->>'y') !~ '^[0-9]+$' OR (e->>'z') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'GRID_REQUIRED'; END IF;
 uid:=(e->>'id')::uuid;typ:=e->>'sectionId';version:=e->>'geometryVersion';
 v:=(e->>'variant')::int;r:=(e->>'rotation')::int;
 px:=(e->>'x')::int;py:=(e->>'y')::int;pz:=(e->>'z')::int;
 dims:=private.tower_v3_size(typ,r);
 valid:=CASE
 WHEN typ='1x1x1' THEN version='17.7-approved-manual.1' AND v BETWEEN 0 AND 1
 WHEN typ='2x2x2' THEN version='17.7-approved-manual.1' AND v BETWEEN 0 AND 2
 WHEN typ='2x3x4' THEN version='17.7-approved-manual.1' AND v BETWEEN 0 AND 2
 WHEN typ='3x3x3' THEN version='17.7-approved-manual.1' AND v BETWEEN 0 AND 1
 WHEN typ='window-4x5x2' THEN version='17.6-window.1' AND v=0
 WHEN typ='door-7x9x2' THEN version='17.6-door.1' AND v=0
 WHEN typ='gate-18x10x2' THEN version='17.6-gate.1' AND v=0
 WHEN typ='bagana-2x10x2' THEN version='17.2-bagana.1' AND v=0
 ELSE false END;
 IF uid IS NULL OR dims IS NULL OR NOT COALESCE(valid,false) OR r NOT BETWEEN 0 AND 3 OR
 px+dims[1]>60 OR py+dims[2]>80 OR pz+dims[3]>120 THEN RAISE EXCEPTION 'INVALID_V3_SECTION'; END IF;
 RETURN jsonb_build_object('id',uid,'type','masonry_section','sectionId',typ,
 'variant',v,'rotation',r,'x',px,'y',py,'z',pz,'geometryVersion',version);
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range
 THEN RAISE EXCEPTION 'INVALID_V3_SECTION';
END $function$



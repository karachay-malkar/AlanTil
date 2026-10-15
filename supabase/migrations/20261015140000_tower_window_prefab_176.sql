-- AlanTil 17.6 window prefab; additive, existing V3 and legacy content preserved.
BEGIN;
ALTER TABLE private.tower_v3_sections DROP CONSTRAINT IF EXISTS tower_v3_sections_section_id_check;
ALTER TABLE private.tower_v3_sections ADD CONSTRAINT tower_v3_sections_section_id_check
 CHECK(section_id IN ('1x1x1','2x2x2','2x2x3','2x3x4','4x4x4','window-4x5x2'));
ALTER TABLE private.tower_v3_sections DROP CONSTRAINT IF EXISTS tower_v3_sections_geometry_version_check;
ALTER TABLE private.tower_v3_sections ADD CONSTRAINT tower_v3_sections_geometry_version_check
 CHECK(geometry_version IN ('17.5.0','17.5.1','17.5.2','17.6-window.1'));
ALTER TABLE private.tower_v3_sections ADD CONSTRAINT tower_v3_window_version_variant_check CHECK(
 (section_id='window-4x5x2' AND geometry_version='17.6-window.1' AND variant_id=0)
 OR (section_id<>'window-4x5x2' AND geometry_version<>'17.6-window.1')
);
CREATE OR REPLACE FUNCTION private.tower_v3_size(p_type text,p_rotation integer)
RETURNS integer[] LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE p_type
 WHEN '1x1x1' THEN ARRAY[1,1,1]
 WHEN '2x2x2' THEN ARRAY[2,2,2]
 WHEN '2x2x3' THEN CASE WHEN p_rotation%2=1 THEN ARRAY[3,2,2] ELSE ARRAY[2,2,3] END
 WHEN '2x3x4' THEN CASE WHEN p_rotation%2=1 THEN ARRAY[4,3,2] ELSE ARRAY[2,3,4] END
 WHEN '4x4x4' THEN ARRAY[4,4,4]
 WHEN 'window-4x5x2' THEN CASE WHEN p_rotation%2=1 THEN ARRAY[2,5,4] ELSE ARRAY[4,5,2] END
 ELSE NULL::integer[] END
$$;
CREATE OR REPLACE FUNCTION private.tower_v3_canonical(e jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE typ text;v int;r int;px int;py int;pz int;dims int[];uid uuid;version text;
BEGIN
 IF e IS NULL OR jsonb_typeof(e)<>'object' THEN RAISE EXCEPTION 'INVALID_V3_SECTION';END IF;
 IF (e->>'id') IS NULL OR (e->>'sectionId') IS NULL OR (e->>'geometryVersion') IS NULL OR
 (e->>'variant') IS NULL OR (e->>'rotation') IS NULL OR (e->>'x') IS NULL OR
 (e->>'y') IS NULL OR (e->>'z') IS NULL THEN RAISE EXCEPTION 'INVALID_V3_SECTION';END IF;
 IF (e->>'variant') !~ '^[0-9]+$' OR (e->>'rotation') !~ '^[0-9]+$' OR
 (e->>'x') !~ '^[0-9]+$' OR (e->>'y') !~ '^[0-9]+$' OR (e->>'z') !~ '^[0-9]+$'
 THEN RAISE EXCEPTION 'GRID_REQUIRED';END IF;
 uid:=(e->>'id')::uuid;typ:=e->>'sectionId';version:=e->>'geometryVersion';
 v:=(e->>'variant')::int;r:=(e->>'rotation')::int;
 px:=(e->>'x')::int;py:=(e->>'y')::int;pz:=(e->>'z')::int;
 dims:=private.tower_v3_size(typ,r);
 IF uid IS NULL OR dims IS NULL OR v NOT BETWEEN 0 AND 7 OR r NOT BETWEEN 0 AND 3 OR
 version NOT IN ('17.5.0','17.5.1','17.5.2','17.6-window.1') OR
 px+dims[1]>60 OR py+dims[2]>80 OR pz+dims[3]>60
 THEN RAISE EXCEPTION 'INVALID_V3_SECTION';END IF;
 IF (typ='window-4x5x2' AND (version<>'17.6-window.1' OR v<>0)) OR
 (typ<>'window-4x5x2' AND (version='17.6-window.1' OR (version='17.5.2' AND v>2)))
 THEN RAISE EXCEPTION 'INVALID_V3_SECTION';END IF;
 RETURN jsonb_build_object('id',uid,'type','masonry_section','sectionId',typ,
 'variant',v,'rotation',r,'x',px,'y',py,'z',pz,'geometryVersion',version);
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range
 THEN RAISE EXCEPTION 'INVALID_V3_SECTION';
END $$;
COMMIT;

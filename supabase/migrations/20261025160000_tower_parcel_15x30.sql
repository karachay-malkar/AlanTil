-- AlanTil 17.2.18: parcel X=15m (60 cells), Z=30m (120 cells).
-- Preserve existing saves, auth, support logic and 20m vertical height.
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
 ELSE false END;
 IF uid IS NULL OR dims IS NULL OR NOT COALESCE(valid,false) OR r NOT BETWEEN 0 AND 3 OR
 px+dims[1]>60 OR py+dims[2]>80 OR pz+dims[3]>120 THEN RAISE EXCEPTION 'INVALID_V3_SECTION'; END IF;
 RETURN jsonb_build_object('id',uid,'type','masonry_section','sectionId',typ,
 'variant',v,'rotation',r,'x',px,'y',py,'z',pz,'geometryVersion',version);
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range
 THEN RAISE EXCEPTION 'INVALID_V3_SECTION';
END $function$


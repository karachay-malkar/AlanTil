-- AlanTil 17.2.54: atomic placement of contiguous pre-approved masonry rows.
-- Extend 1x1x1 canonical check to match all three shipped approved variants.
DO $adjust$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('private.tower_v3_canonical(jsonb)'::regprocedure) INTO definition;
 IF position('WHEN typ=''1x1x1'' THEN version=''17.7-approved-manual.1'' AND v BETWEEN 0 AND 1' IN definition)>0 THEN
  definition:=replace(definition,
   'WHEN typ=''1x1x1'' THEN version=''17.7-approved-manual.1'' AND v BETWEEN 0 AND 1',
   'WHEN typ=''1x1x1'' THEN version=''17.7-approved-manual.1'' AND v BETWEEN 0 AND 2');
  EXECUTE definition;
 ELSIF position('WHEN typ=''1x1x1'' THEN version=''17.7-approved-manual.1'' AND v BETWEEN 0 AND 2' IN definition)=0
 THEN RAISE EXCEPTION 'Unexpected canonical masonry variant contract'; END IF;
END $adjust$;

CREATE OR REPLACE FUNCTION private.mutate_tower_v3_line(
 p_revision bigint,p_operation_id uuid,p_sections jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE uid uuid:=auth.uid();revision_now bigint;receipt private.tower_v3_receipts;
 request jsonb;all_sections jsonb;canon jsonb:='[]'::jsonb;candidate jsonb;block jsonb;
 section_type text:=null;level_cells integer:=null;
 prev_x integer;prev_z integer;current_x integer;current_z integer;prev_size integer[];
 sz integer[];axis text:=null;direction integer:=null;price integer:=0;balance_now bigint;result jsonb;
 n integer;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
 IF p_revision IS NULL OR p_revision<0 OR p_operation_id IS NULL OR p_sections IS NULL OR
  jsonb_typeof(p_sections)<>'array' THEN RAISE EXCEPTION 'INVALID_LINE_REQUEST';END IF;
 n:=jsonb_array_length(p_sections);
 IF n<2 OR n>60 THEN RAISE EXCEPTION 'INVALID_LINE_SIZE';END IF;
 request:=jsonb_build_array('tower_v3_line_v1',p_revision,p_sections);
 INSERT INTO private.tower_accounts(user_id) VALUES(uid) ON CONFLICT DO NOTHING;
 PERFORM 1 FROM private.tower_accounts WHERE user_id=uid FOR UPDATE;
 INSERT INTO private.tower_v3_state(user_id) VALUES(uid) ON CONFLICT DO NOTHING;
 SELECT revision INTO revision_now FROM private.tower_v3_state WHERE user_id=uid FOR UPDATE;
 SELECT * INTO receipt FROM private.tower_v3_receipts WHERE user_id=uid AND operation_id=p_operation_id;
 IF FOUND THEN
  IF receipt.request<>request THEN RAISE EXCEPTION 'OPERATION_ID_REUSED';END IF;
  RETURN receipt.response||jsonb_build_object('replayed',true);
 END IF;
 IF revision_now<>p_revision THEN RAISE EXCEPTION 'REVISION_CONFLICT';END IF;
 PERFORM private.tower_refresh_rewards(uid);
 all_sections:=private.tower_v3_snapshot_rows(uid);
 IF jsonb_array_length(all_sections)+n>250 THEN RAISE EXCEPTION 'TOWER_SECTION_LIMIT';END IF;
 FOR block IN SELECT value FROM jsonb_array_elements(p_sections) LOOP
  candidate:=private.tower_v3_canonical(block);
  IF candidate->>'type'<>'masonry_section' OR candidate->>'sectionId' NOT IN ('1x1x1','2x2x2','2x3x4','3x3x3')
  THEN RAISE EXCEPTION 'LINE_MASONRY_ONLY';END IF;
  current_x:=(candidate->>'x')::integer;
  current_z:=(candidate->>'z')::integer;
  sz:=private.tower_v3_size(candidate->>'sectionId',(candidate->>'rotation')::integer);
  IF section_type IS NULL THEN
   section_type:=candidate->>'sectionId';level_cells:=(candidate->>'y')::integer;
  ELSE
   IF candidate->>'sectionId'<>section_type OR (candidate->>'y')::integer<>level_cells OR
      sz[1]<>prev_size[1] OR sz[3]<>prev_size[3]
   THEN RAISE EXCEPTION 'INVALID_LINE_SHAPE';END IF;
   IF axis IS NULL THEN
    IF current_z=prev_z AND abs(current_x-prev_x)=sz[1] THEN
     axis:='x';direction:=sign(current_x-prev_x)::integer;
    ELSIF current_x=prev_x AND abs(current_z-prev_z)=sz[3] THEN
     axis:='z';direction:=sign(current_z-prev_z)::integer;
    ELSE RAISE EXCEPTION 'INVALID_LINE_GEOMETRY';END IF;
   ELSIF (axis='x' AND (current_z<>prev_z OR current_x-prev_x<>direction*sz[1]))
     OR (axis='z' AND (current_x<>prev_x OR current_z-prev_z<>direction*sz[3]))
   THEN RAISE EXCEPTION 'INVALID_LINE_GEOMETRY';END IF;
  END IF;
  prev_x:=current_x;prev_z:=current_z;prev_size:=sz;
  price:=price+private.tower_tekmet_section_cost(candidate->>'sectionId');
  canon:=canon||jsonb_build_array(candidate);
 END LOOP;
 IF NOT private.tower_v3_valid_layout(uid,all_sections||canon) THEN
  RAISE EXCEPTION 'INVALID_V3_PLACEMENT';END IF;
 UPDATE private.tower_accounts SET tekmet=tekmet-price,updated_at=now()
 WHERE user_id=uid AND tekmet>=price RETURNING tekmet INTO balance_now;
 IF NOT FOUND THEN RAISE EXCEPTION 'INSUFFICIENT_TEKMET';END IF;
 FOR candidate IN SELECT value FROM jsonb_array_elements(canon) LOOP
  INSERT INTO private.tower_v3_sections(
   user_id,id,section_id,variant_id,geometry_version,grid_x,grid_y,grid_z,rotation,tekmet_paid)
  VALUES(uid,(candidate->>'id')::uuid,candidate->>'sectionId',
   (candidate->>'variant')::smallint,candidate->>'geometryVersion',
   (candidate->>'x')::integer,(candidate->>'y')::integer,(candidate->>'z')::integer,
   (candidate->>'rotation')::smallint,private.tower_tekmet_section_cost(candidate->>'sectionId'));
 END LOOP;
 UPDATE private.tower_v3_state SET revision=revision+1,updated_at=now() WHERE user_id=uid;
 result:=jsonb_build_object('format',3,'revision',revision_now+1,'elements',
  private.tower_v3_snapshot_rows(uid),'tekmetBalance',balance_now,'charged',price,'refunded',0);
 INSERT INTO private.tower_v3_receipts(user_id,operation_id,request,response)
 VALUES(uid,p_operation_id,request,result);
 RETURN result;
END $function$;
REVOKE ALL ON FUNCTION private.mutate_tower_v3_line(bigint,uuid,jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.mutate_tower_v3_line(
 p_revision bigint,p_operation_id uuid,p_sections jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
 RETURN private.mutate_tower_v3_line(p_revision,p_operation_id,p_sections);
END $function$;
REVOKE ALL ON FUNCTION public.mutate_tower_v3_line(bigint,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mutate_tower_v3_line(bigint,uuid,jsonb) TO authenticated;

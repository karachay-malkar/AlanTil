-- AlanTil 17.2.46: independently saved roof beams. Support is checked ONLY at insertion.
ALTER TABLE private.tower_v3_sections DROP CONSTRAINT tower_v3_sections_section_id_check;
ALTER TABLE private.tower_v3_sections ADD CONSTRAINT tower_v3_sections_section_id_check
 CHECK (section_id IN ('1x1x1','2x2x2','2x2x3','2x3x4','4x4x4','window-4x5x2','door-7x9x2','gate-18x10x2','3x3x3','bagana-2x10x2') OR
 section_id ~ '^bagana-f[123]-3x(9|10|11|12|13)x3$' OR section_id ~ '^roof-beam-([1-9]|[1-3][0-9]|40)$');
ALTER TABLE private.tower_v3_sections DROP CONSTRAINT tower_v3_sections_geometry_version_check;
ALTER TABLE private.tower_v3_sections ADD CONSTRAINT tower_v3_sections_geometry_version_check
 CHECK (geometry_version IN ('17.5.0','17.5.1','17.5.2','17.6-window.1','17.6-door.1','17.5.3','17.6-gate.1','17.5.4','17.5.5','17.7-approved-manual.1','17.2-bagana.1','17.2-bagana.2','17.2-roof-beam.1'));
CREATE OR REPLACE FUNCTION private.tower_v3_size(p_type text, p_rotation integer)
 RETURNS integer[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
SELECT CASE
 WHEN p_type='1x1x1' THEN ARRAY[1,1,1]
 WHEN p_type='2x2x2' THEN ARRAY[2,2,2]
 WHEN p_type='2x3x4' THEN CASE WHEN p_rotation%2=1 THEN ARRAY[4,3,2] ELSE ARRAY[2,3,4] END
 WHEN p_type='3x3x3' THEN ARRAY[3,3,3]
 WHEN p_type='window-4x5x2' THEN CASE WHEN p_rotation%2=1 THEN ARRAY[2,5,4] ELSE ARRAY[4,5,2] END
 WHEN p_type='door-7x9x2' THEN CASE WHEN p_rotation%2=1 THEN ARRAY[2,9,7] ELSE ARRAY[7,9,2] END
 WHEN p_type='gate-18x10x2' THEN CASE WHEN p_rotation%2=1 THEN ARRAY[2,10,18] ELSE ARRAY[18,10,2] END
 WHEN p_type='bagana-2x10x2' THEN ARRAY[2,10,2]
 WHEN p_type ~ '^bagana-f[123]-3x(9|10|11|12|13)x3$' THEN ARRAY[3,split_part(p_type,'x',2)::int,3]
 WHEN p_type ~ '^roof-beam-([1-9]|[1-3][0-9]|40)
$function$;
 THEN CASE WHEN p_rotation%2=1 THEN ARRAY[1,1,split_part(p_type,'-',3)::int] ELSE ARRAY[split_part(p_type,'-',3)::int,1,1] END
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
 WHEN typ ~ '^bagana-f[123]-3x(9|10|11|12|13)x3$' THEN version='17.2-bagana.2' AND v=0
 WHEN typ ~ '^roof-beam-([1-9]|[1-3][0-9]|40)
 IF uid IS NULL OR dims IS NULL OR NOT COALESCE(valid,false) OR r NOT BETWEEN 0 AND 3 OR
 px+dims[1]>60 OR py+dims[2]>80 OR pz+dims[3]>120 THEN RAISE EXCEPTION 'INVALID_V3_SECTION'; END IF;
 RETURN jsonb_build_object('id',uid,'type',CASE WHEN typ LIKE 'roof-beam-%' THEN 'roof_beam' ELSE 'masonry_section' END,'sectionId',typ,
 'variant',v,'rotation',r,'x',px,'y',py,'z',pz,'geometryVersion',version);
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range
 THEN RAISE EXCEPTION 'INVALID_V3_SECTION';
END $function$;
 THEN version='17.2-roof-beam.1' AND v=0 AND e->>'type'='roof_beam'
 ELSE false END;
 IF uid IS NULL OR dims IS NULL OR NOT COALESCE(valid,false) OR r NOT BETWEEN 0 AND 3 OR
 px+dims[1]>60 OR py+dims[2]>80 OR pz+dims[3]>120 THEN RAISE EXCEPTION 'INVALID_V3_SECTION'; END IF;
 RETURN jsonb_build_object('id',uid,'type','masonry_section','sectionId',typ,
 'variant',v,'rotation',r,'x',px,'y',py,'z',pz,'geometryVersion',version);
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range
 THEN RAISE EXCEPTION 'INVALID_V3_SECTION';
END $function$;

CREATE OR REPLACE FUNCTION private.tower_v3_snapshot_rows(p_uid uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO ''
AS $function$
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,
  'type',CASE WHEN section_id LIKE 'roof-beam-%' THEN 'roof_beam' ELSE 'masonry_section' END,
  'sectionId',section_id,'variant',variant_id,'rotation',rotation,'x',grid_x,'y',grid_y,'z',grid_z,
  'geometryVersion',geometry_version) ORDER BY created_at,id),'[]'::jsonb)
 FROM private.tower_v3_sections WHERE user_id=p_uid
$function$;

CREATE OR REPLACE FUNCTION private.tower_v3_valid_layout(p_uid uuid, p_sections jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare e jsonb;others jsonb:='[]'::jsonb;all_boxes jsonb;box jsonb;other jsonb;dims int[];
 px numeric;py numeric;pz numeric;sx numeric;sy numeric;sz numeric;
 x int;y int;z int;supported boolean;seen_ids uuid[]:=array[]::uuid[];
begin
 if p_sections is null or jsonb_typeof(p_sections)<>'array' or jsonb_array_length(p_sections)>250 then return false;end if;
 for e in select value from jsonb_array_elements(p_sections) loop
  begin e:=private.tower_v3_canonical(e);exception when others then return false;end;
  if (e->>'id')::uuid=any(seen_ids) then return false;end if;
  seen_ids:=array_append(seen_ids,(e->>'id')::uuid);
  dims:=private.tower_v3_size(e->>'sectionId',(e->>'rotation')::int);
  others:=others||jsonb_build_array(jsonb_build_object('id',e->>'id','x',e->'x','y',e->'y','z',e->'z',
     'sx',dims[1],'sy',dims[2],'sz',dims[3],'support',e->>'type'='masonry_section'));
 end loop;
 all_boxes:=others;
 for box in select value from jsonb_array_elements(others) loop
  px:=(box->>'x')::numeric;py:=(box->>'y')::numeric;pz:=(box->>'z')::numeric;
  sx:=(box->>'sx')::numeric;sy:=(box->>'sy')::numeric;sz:=(box->>'sz')::numeric;
  if NOT (box->>'support')::boolean THEN CONTINUE; END IF;
  for other in select value from jsonb_array_elements(all_boxes) loop
   if NOT (other->>'support')::boolean THEN CONTINUE; END IF;
   if other->>'id'=box->>'id' and other ? 'id' then continue;end if;
   if px<(other->>'x')::numeric+(other->>'sx')::numeric and px+sx>(other->>'x')::numeric and
      py<(other->>'y')::numeric+(other->>'sy')::numeric and py+sy>(other->>'y')::numeric and
      pz<(other->>'z')::numeric+(other->>'sz')::numeric and pz+sz>(other->>'z')::numeric then return false;end if;
  end loop;
  if py=0 then continue;end if;
  for x in px::int..(px+sx)::int-1 loop for z in pz::int..(pz+sz)::int-1 loop
   supported:=false;
   for other in select value from jsonb_array_elements(all_boxes) loop
    if not coalesce((other->>'support')::boolean,false) then continue;end if;
    if abs((other->>'y')::numeric+(other->>'sy')::numeric-py)<.00001 and
       x+.5>=(other->>'x')::numeric and x+.5<=(other->>'x')::numeric+(other->>'sx')::numeric and
       z+.5>=(other->>'z')::numeric and z+.5<=(other->>'z')::numeric+(other->>'sz')::numeric then supported:=true;exit;end if;
   end loop;
   if not supported then return false;end if;
  end loop;end loop;
 end loop;
 return true;
end $function$;

CREATE OR REPLACE FUNCTION private.tower_v3_beam_has_anchor(p_sections jsonb,p_beam jsonb)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO ''
AS $function$
 SELECT EXISTS (
  SELECT 1 FROM jsonb_array_elements(p_sections) AS s(elem)
  WHERE elem->>'type'='masonry_section'
    AND (elem->>'y')::int+
        (private.tower_v3_size(elem->>'sectionId',(elem->>'rotation')::int))[2]=(p_beam->>'y')::int
    AND (elem->>'x')::int<
        (p_beam->>'x')::int+(private.tower_v3_size(p_beam->>'sectionId',(p_beam->>'rotation')::int))[1]
    AND (elem->>'x')::int+
        (private.tower_v3_size(elem->>'sectionId',(elem->>'rotation')::int))[1]>(p_beam->>'x')::int
    AND (elem->>'z')::int<
        (p_beam->>'z')::int+(private.tower_v3_size(p_beam->>'sectionId',(p_beam->>'rotation')::int))[3]
    AND (elem->>'z')::int+
        (private.tower_v3_size(elem->>'sectionId',(elem->>'rotation')::int))[3]>(p_beam->>'z')::int
 )
$function$;

CREATE OR REPLACE FUNCTION private.mutate_tower_v3(p_revision bigint, p_operation_id uuid, p_action text, p_section jsonb DEFAULT NULL::jsonb, p_section_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid:=auth.uid();state private.tower_v3_state; receipt private.tower_v3_receipts;
 req jsonb;current_sections jsonb;candidate jsonb;new_sections jsonb;result jsonb;eid uuid;
begin
 if uid is null then raise exception 'AUTH_REQUIRED';end if;
 if p_revision is null or p_revision<0 or p_operation_id is null or p_action not in ('place','remove') then raise exception 'INVALID_V3_REQUEST';end if;
 req:=jsonb_build_array('tower_v3',p_revision,p_action,p_section,p_section_id);
 insert into private.tower_v3_state(user_id) values(uid) on conflict do nothing;
 
 select * into state from private.tower_v3_state where user_id=uid for update;
 select * into receipt from private.tower_v3_receipts where user_id=uid and operation_id=p_operation_id;
 if found then
  if receipt.request<>req then raise exception 'OPERATION_ID_REUSED';end if;
  return receipt.response||jsonb_build_object('replayed',true);
 end if;
 if state.revision<>p_revision then raise exception 'REVISION_CONFLICT';end if;
 current_sections:=private.tower_v3_snapshot_rows(uid);
 if p_action='place' then
  if p_section_id is not null then raise exception 'INVALID_V3_REQUEST';end if;
  candidate:=private.tower_v3_canonical(p_section);eid:=(candidate->>'id')::uuid;
  if exists(select 1 from private.tower_v3_sections where user_id=uid and id=eid) then raise exception 'DUPLICATE_SECTION';end if;
  if candidate->>'type'='roof_beam' and not private.tower_v3_beam_has_anchor(current_sections,candidate) then raise exception 'BEAM_ANCHOR_REQUIRED';end if;
  new_sections:=current_sections||jsonb_build_array(candidate);
  if not private.tower_v3_valid_layout(uid,new_sections) then raise exception 'INVALID_V3_PLACEMENT';end if;
  insert into private.tower_v3_sections(user_id,id,section_id,variant_id,geometry_version,grid_x,grid_y,grid_z,rotation)
   values(uid,eid,candidate->>'sectionId',(candidate->>'variant')::smallint,candidate->>'geometryVersion',
   (candidate->>'x')::integer,(candidate->>'y')::integer,(candidate->>'z')::integer,(candidate->>'rotation')::smallint);
 elsif p_action='remove' then
  if p_section is not null or p_section_id is null then raise exception 'INVALID_V3_REQUEST';end if;
  if not exists(select 1 from private.tower_v3_sections where user_id=uid and id=p_section_id) then raise exception 'UNKNOWN_V3_SECTION';end if;
  select coalesce(jsonb_agg(value),'[]'::jsonb) into new_sections from jsonb_array_elements(current_sections) x where x.value->>'id'<>p_section_id::text;
  if not private.tower_v3_valid_layout(uid,new_sections) then raise exception 'SUPPORT_REQUIRED';end if;
  delete from private.tower_v3_sections where user_id=uid and id=p_section_id;
 end if;
 update private.tower_v3_state set revision=revision+1,updated_at=now() where user_id=uid;
 result:=jsonb_build_object('format',3,'revision',state.revision+1,'elements',private.tower_v3_snapshot_rows(uid));
 insert into private.tower_v3_receipts(user_id,operation_id,request,response) values(uid,p_operation_id,req,result);
 return result;
end $function$;

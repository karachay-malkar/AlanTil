-- Qualify the roof coverage variable, avoiding collision with the table's cells column.
CREATE OR REPLACE FUNCTION private.mutate_tower_roof(p_operation_id uuid, p_points jsonb, p_level integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE uid uuid:=auth.uid();receipt private.tower_v3_roof_receipts;
 request jsonb;new_cells jsonb;amount integer;cell jsonb;section jsonb;sections jsonb;
 x integer;z integer;px integer;py integer;pz integer;dims integer[];supported boolean;balance_now bigint;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
 IF p_operation_id IS NULL OR p_level IS NULL OR p_level NOT BETWEEN 0 AND 79 THEN RAISE EXCEPTION 'INVALID_ROOF_REQUEST';END IF;
 request:=jsonb_build_array('roof_v1',p_points,p_level);
 INSERT INTO private.tower_accounts(user_id) VALUES(uid) ON CONFLICT DO NOTHING;
 PERFORM 1 FROM private.tower_accounts WHERE user_id=uid FOR UPDATE;
 INSERT INTO private.tower_v3_state(user_id) VALUES(uid) ON CONFLICT DO NOTHING;
 PERFORM 1 FROM private.tower_v3_state WHERE user_id=uid FOR UPDATE;
 SELECT * INTO receipt FROM private.tower_v3_roof_receipts WHERE user_id=uid AND operation_id=p_operation_id;
 IF FOUND THEN
  IF receipt.request<>request THEN RAISE EXCEPTION 'OPERATION_ID_REUSED';END IF;
  RETURN receipt.response||jsonb_build_object('replayed',true);
 END IF;
 PERFORM private.tower_refresh_rewards(uid);
 new_cells:=private.tower_roof_cells(p_points);
 amount:=jsonb_array_length(new_cells)*2;
 IF amount<2 OR amount>14400 THEN RAISE EXCEPTION 'INVALID_ROOF_AREA';END IF;
 sections:=private.tower_v3_snapshot_rows(uid);
 FOR cell IN SELECT value FROM jsonb_array_elements(new_cells) LOOP
  x:=(cell->>0)::integer;z:=(cell->>1)::integer;supported:=false;
  FOR section IN SELECT value FROM jsonb_array_elements(sections) LOOP
   dims:=private.tower_v3_size(section->>'sectionId',(section->>'rotation')::integer);
   px:=(section->>'x')::integer;py:=(section->>'y')::integer;pz:=(section->>'z')::integer;
   IF py+dims[2]=p_level AND x BETWEEN px-2 AND px+dims[1]+1 AND z BETWEEN pz-2 AND pz+dims[3]+1 THEN supported:=true;END IF;
   IF section->>'type'='masonry_section' AND py<=p_level AND py+dims[2]>p_level AND
    x>=px AND x<px+dims[1] AND z>=pz AND z<pz+dims[3] THEN RAISE EXCEPTION 'ROOF_COLLISION';END IF;
  END LOOP;
  IF NOT supported THEN RAISE EXCEPTION 'ROOF_SUPPORT_REQUIRED';END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM private.tower_v3_roofs r,jsonb_array_elements(r.cells) c
  WHERE r.user_id=uid AND r.level_cells=p_level
  AND c.value IN (SELECT value FROM jsonb_array_elements(new_cells)))
 THEN RAISE EXCEPTION 'ROOF_OVERLAP';END IF;
 UPDATE private.tower_accounts SET tekmet=tekmet-amount
  WHERE user_id=uid AND tekmet>=amount RETURNING tekmet INTO balance_now;
 IF NOT FOUND THEN RAISE EXCEPTION 'INSUFFICIENT_TEKMET';END IF;
 INSERT INTO private.tower_v3_roofs(user_id,id,level_cells,points,cells,cell_count,cost_silver,tekmet_paid)
 VALUES(uid,p_operation_id,p_level,p_points,new_cells,jsonb_array_length(new_cells),0,amount);
 INSERT INTO private.tower_v3_roof_receipts(user_id,operation_id,request,response)
 VALUES(uid,p_operation_id,request,private.tower_roof_snapshot(uid));
 RETURN private.tower_roof_snapshot(uid);
END $function$


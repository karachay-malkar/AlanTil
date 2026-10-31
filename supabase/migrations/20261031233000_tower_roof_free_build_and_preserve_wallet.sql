-- Temporary free roof construction. Preserve nominal 4-coin policy in client for a future paid release.
-- The current saved cost is 0, and no wallet debit occurs.
ALTER TABLE private.tower_v3_roofs DROP CONSTRAINT tower_v3_roofs_check;
ALTER TABLE private.tower_v3_roofs ADD CONSTRAINT tower_v3_roofs_free_or_nominal_cost_check
 CHECK (cost_silver=0 OR cost_silver=4*cell_count);
CREATE OR REPLACE FUNCTION private.mutate_tower_roof(p_operation_id uuid, p_points jsonb, p_level integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE uid uuid:=auth.uid(); old_receipt private.tower_v3_roof_receipts;
 req jsonb; cc jsonb; cnt int;price int;cell jsonb;b jsonb;sections jsonb;
 gx int;gz int;px int;py int;pz int;dims int[];supported boolean;new_balance bigint;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
 IF p_operation_id IS NULL OR p_level IS NULL OR p_level NOT BETWEEN 0 AND 79 THEN RAISE EXCEPTION 'INVALID_ROOF_REQUEST';END IF;
 req:=jsonb_build_array('roof_v1',p_points,p_level);
 INSERT INTO private.tower_v3_state(user_id) VALUES(uid) ON CONFLICT DO NOTHING;
 PERFORM 1 FROM private.tower_v3_state WHERE user_id=uid FOR UPDATE;
 SELECT * INTO old_receipt FROM private.tower_v3_roof_receipts WHERE user_id=uid AND operation_id=p_operation_id;
 IF FOUND THEN
  IF old_receipt.request<>req THEN RAISE EXCEPTION 'OPERATION_ID_REUSED';END IF;
  RETURN old_receipt.response||jsonb_build_object('replayed',true);
 END IF;
 cc:=private.tower_roof_cells(p_points);cnt:=jsonb_array_length(cc);price:=0;
 IF cnt<1 OR cnt>7200 THEN RAISE EXCEPTION 'INVALID_ROOF_AREA';END IF;
 sections:=private.tower_v3_snapshot_rows(uid);
 FOR cell IN SELECT value FROM jsonb_array_elements(cc) LOOP
  gx:=(cell->>0)::int;gz:=(cell->>1)::int;supported:=false;
  FOR b IN SELECT value FROM jsonb_array_elements(sections) LOOP
   dims:=private.tower_v3_size(b->>'sectionId',(b->>'rotation')::int);
   px:=(b->>'x')::int;py:=(b->>'y')::int;pz:=(b->>'z')::int;
   IF py+dims[2]=p_level AND gx BETWEEN px-2 AND px+dims[1]+1 AND gz BETWEEN pz-2 AND pz+dims[3]+1 THEN supported:=true;END IF;
   IF b->>'type'='masonry_section' AND py<=p_level AND py+dims[2]>p_level AND
    gx>=px AND gx<px+dims[1] AND gz>=pz AND gz<pz+dims[3] THEN RAISE EXCEPTION 'ROOF_COLLISION';END IF;
  END LOOP;
  IF NOT supported THEN RAISE EXCEPTION 'ROOF_SUPPORT_REQUIRED';END IF;
 END LOOP;
 IF EXISTS(
  SELECT 1 FROM private.tower_v3_roofs r,jsonb_array_elements(r.cells) c
   WHERE r.user_id=uid AND r.level_cells=p_level
    AND c.value IN (SELECT value FROM jsonb_array_elements(cc))
 ) THEN RAISE EXCEPTION 'ROOF_OVERLAP';END IF;
 INSERT INTO private.tower_accounts(user_id) VALUES(uid) ON CONFLICT DO NOTHING;
 PERFORM 1 FROM private.tower_accounts WHERE user_id=uid FOR UPDATE;
 -- Free-building mode: keep previous earned coins unchanged.
 INSERT INTO private.tower_v3_roofs(user_id,id,level_cells,points,cells,cell_count,cost_silver)
 VALUES(uid,p_operation_id,p_level,p_points,cc,cnt,price);
 INSERT INTO private.tower_v3_roof_receipts(user_id,operation_id,request,response)
 VALUES(uid,p_operation_id,req,private.tower_roof_snapshot(uid));
 RETURN private.tower_roof_snapshot(uid);
END $function$


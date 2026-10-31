
-- Public tower viewers see roof geometry, never another user's coin balance.
CREATE OR REPLACE FUNCTION public.get_tower_roof_snapshot(p_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE uid uuid:=auth.uid();target uuid:=coalesce(p_user_id,auth.uid());snapshot jsonb;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
 snapshot:=private.tower_roof_snapshot(target);
 IF target<>uid THEN snapshot:=jsonb_set(snapshot,'{balance}','0'::jsonb);END IF;
 RETURN snapshot;
END $f$;
REVOKE ALL ON FUNCTION public.get_tower_roof_snapshot(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_tower_roof_snapshot(uuid) TO authenticated;

-- A roof may not lose the final wooden beam or masonry top supporting any cell.
CREATE OR REPLACE FUNCTION private.tower_roof_keep_support()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE r record;cell jsonb;gx integer;gz integer;support_count integer;dims integer[];
BEGIN
 dims:=private.tower_v3_size(OLD.section_id,OLD.rotation);
 IF NOT EXISTS(SELECT 1 FROM private.tower_v3_roofs WHERE user_id=OLD.user_id AND level_cells=OLD.grid_y+dims[2]) THEN RETURN OLD;END IF;
 FOR r IN SELECT level_cells,cells FROM private.tower_v3_roofs
  WHERE user_id=OLD.user_id AND level_cells=OLD.grid_y+dims[2] LOOP
  FOR cell IN SELECT value FROM jsonb_array_elements(r.cells) LOOP
   gx:=(cell->>0)::integer;gz:=(cell->>1)::integer;
   SELECT count(*) INTO support_count FROM private.tower_v3_sections b
    WHERE b.user_id=OLD.user_id AND b.id<>OLD.id
     AND b.grid_y+(private.tower_v3_size(b.section_id,b.rotation))[2]=r.level_cells
     AND gx BETWEEN b.grid_x-2 AND b.grid_x+(private.tower_v3_size(b.section_id,b.rotation))[1]+1
     AND gz BETWEEN b.grid_z-2 AND b.grid_z+(private.tower_v3_size(b.section_id,b.rotation))[3]+1;
   IF support_count=0 THEN RAISE EXCEPTION 'ROOF_SUPPORT_REQUIRED';END IF;
  END LOOP;
 END LOOP;
 RETURN OLD;
END $f$;
REVOKE ALL ON FUNCTION private.tower_roof_keep_support() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER tower_roof_block_unsupported_delete
 BEFORE DELETE ON private.tower_v3_sections
 FOR EACH ROW EXECUTE FUNCTION private.tower_roof_keep_support();

-- Preserve current V3 clearing semantics, deleting roofs FIRST so roof-support guard does not prevent an explicit reset.
CREATE OR REPLACE FUNCTION private.clear_tower_v3(p_revision bigint,p_operation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE uid uuid:=auth.uid();state private.tower_v3_state;receipt private.tower_v3_receipts;
 req jsonb;result jsonb;watermark timestamptz;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
 IF p_revision IS NULL OR p_revision<0 OR p_operation_id IS NULL THEN RAISE EXCEPTION 'INVALID_CLEAR_REQUEST';END IF;
 req:=jsonb_build_array('tower_v3_clear',p_revision);
 INSERT INTO private.tower_v3_state(user_id) VALUES(uid) ON CONFLICT DO NOTHING;
 SELECT * INTO state FROM private.tower_v3_state WHERE user_id=uid FOR UPDATE;
 SELECT * INTO receipt FROM private.tower_v3_receipts WHERE user_id=uid AND operation_id=p_operation_id;
 IF FOUND THEN
  IF receipt.request<>req THEN RAISE EXCEPTION 'OPERATION_ID_REUSED';END IF;
  RETURN receipt.response||jsonb_build_object('replayed',true);
 END IF;
 IF state.revision<>p_revision THEN RAISE EXCEPTION 'REVISION_CONFLICT';END IF;
 DELETE FROM private.tower_v3_roofs WHERE user_id=uid;
 DELETE FROM private.tower_v3_sections WHERE user_id=uid;
 watermark:=clock_timestamp();
 UPDATE private.tower_v3_state SET revision=revision+1,updated_at=now(),reset_at=watermark WHERE user_id=uid;
 result:=jsonb_build_object('format',3,'revision',state.revision+1,'resetAt',watermark,'elements','[]'::jsonb);
 INSERT INTO private.tower_v3_receipts(user_id,operation_id,request,response) VALUES(uid,p_operation_id,req,result);
 RETURN result;
END $f$;

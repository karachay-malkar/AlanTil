-- AlanTil 17.2.70: atomic owner-only batch removal with floating survivors.
-- Historical blocks retain their coordinates, even when their supports are removed.
-- The existing authoritative validator still requires full support for NEW blocks.
DO $patch$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('private.tower_v3_valid_layout(uuid,jsonb)'::regprocedure) INTO definition;
 IF definition IS NULL THEN RAISE EXCEPTION 'Missing tower layout validator'; END IF;
 IF position('persisted_ids uuid[]' in definition)=0 THEN
  IF position('seen_ids uuid[]:=array[]::uuid[];' in definition)=0 OR
     position('if py=0 then continue;end if;' in definition)=0
  THEN RAISE EXCEPTION 'Unexpected tower layout validator contract'; END IF;
  definition:=replace(definition,
    'seen_ids uuid[]:=array[]::uuid[];',
    'seen_ids uuid[]:=array[]::uuid[];persisted_ids uuid[]:=array(select s.id from private.tower_v3_sections s where s.user_id=p_uid);');
  definition:=replace(definition,
    'if py=0 then continue;end if;',
    'if py=0 then continue;end if;
     -- Existing elements may float after removal; newly placed ones still require support.
     if (box->>''id'')::uuid=any(persisted_ids) then continue;end if;');
  EXECUTE definition;
 END IF;
END $patch$;

CREATE OR REPLACE FUNCTION private.remove_tower_v3_sections(
 p_revision bigint,p_operation_id uuid,p_section_ids uuid[]
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
 uid uuid:=auth.uid();revision_now bigint;receipt private.tower_v3_receipts;
 request jsonb;result jsonb;balance_now bigint;refund bigint:=0;
 n integer;distinct_count integer;existing_count integer;removed_count integer;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
 n:=cardinality(p_section_ids);
 IF p_revision IS NULL OR p_revision<0 OR p_operation_id IS NULL OR
    n IS NULL OR n<1 OR n>250 OR array_position(p_section_ids,NULL) IS NOT NULL
 THEN RAISE EXCEPTION 'INVALID_BATCH_REMOVE_REQUEST';END IF;
 SELECT count(DISTINCT x.id) INTO distinct_count FROM unnest(p_section_ids) AS x(id);
 IF distinct_count<>n THEN RAISE EXCEPTION 'DUPLICATE_SECTION_ID';END IF;
 request:=jsonb_build_array('tower_v3_batch_remove_v1',p_revision,to_jsonb(p_section_ids));
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
 SELECT count(*),coalesce(sum(tekmet_paid),0)
  INTO existing_count,refund FROM private.tower_v3_sections
  WHERE user_id=uid AND id=ANY(p_section_ids);
 IF existing_count<>n THEN RAISE EXCEPTION 'UNKNOWN_V3_SECTION';END IF;
 -- Deliberately do not require support in survivors. Only selected IDs are deleted.
 DELETE FROM private.tower_v3_sections WHERE user_id=uid AND id=ANY(p_section_ids);
 GET DIAGNOSTICS removed_count=ROW_COUNT;
 IF removed_count<>n THEN RAISE EXCEPTION 'BATCH_REMOVE_CONFLICT';END IF;
 UPDATE private.tower_accounts SET tekmet=tekmet+refund,updated_at=now()
 WHERE user_id=uid RETURNING tekmet INTO balance_now;
 UPDATE private.tower_v3_state SET revision=revision+1,updated_at=now() WHERE user_id=uid;
 result:=jsonb_build_object('format',3,'revision',revision_now+1,
   'elements',private.tower_v3_snapshot_rows(uid),'tekmetBalance',balance_now,
   'charged',0,'refunded',refund,'removed',n);
 INSERT INTO private.tower_v3_receipts(user_id,operation_id,request,response)
 VALUES(uid,p_operation_id,request,result);
 RETURN result;
END $function$;
REVOKE ALL ON FUNCTION private.remove_tower_v3_sections(bigint,uuid,uuid[]) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.remove_tower_v3_sections(
 p_revision bigint,p_operation_id uuid,p_section_ids uuid[]
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
 RETURN private.remove_tower_v3_sections(p_revision,p_operation_id,p_section_ids);
END $function$;
REVOKE ALL ON FUNCTION public.remove_tower_v3_sections(bigint,uuid,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.remove_tower_v3_sections(bigint,uuid,uuid[]) TO authenticated;

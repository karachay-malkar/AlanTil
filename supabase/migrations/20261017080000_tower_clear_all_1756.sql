-- AlanTil 17.5.6: single owner-bound transaction to reset all tower geometry.
-- Rewards, wallets, learning progress, analytics and favorites are untouched.
ALTER TABLE private.tower_v3_state ADD COLUMN IF NOT EXISTS reset_at timestamptz;

CREATE TABLE IF NOT EXISTS private.tower_clear_receipts (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 operation_id uuid NOT NULL,
 request jsonb NOT NULL,
 response jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,operation_id)
);
ALTER TABLE private.tower_clear_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.tower_clear_receipts FROM PUBLIC,anon,authenticated;

-- get_tower_v3_snapshot returns the reset watermark to block stale offline drafts.
CREATE OR REPLACE FUNCTION private.get_tower_v3_snapshot(p_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=auth.uid();target uuid:=coalesce(p_user_id,auth.uid());
 rev bigint; watermark timestamptz;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
 IF target=uid THEN
  INSERT INTO private.tower_v3_state(user_id) VALUES(uid) ON CONFLICT DO NOTHING;
 END IF;
 SELECT revision,reset_at INTO rev,watermark FROM private.tower_v3_state WHERE user_id=target;
 RETURN jsonb_build_object('format',3,'revision',coalesce(rev,0),
  'resetAt',watermark,'elements',private.tower_v3_snapshot_rows(target));
END $$;

CREATE OR REPLACE FUNCTION private.clear_tower_all(
 p_legacy_revision bigint,p_v3_revision bigint,p_operation_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=auth.uid();legacy_rev bigint;v3_rev bigint;
 receipt private.tower_clear_receipts;req jsonb;result jsonb;watermark timestamptz;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
 IF p_operation_id IS NULL OR p_legacy_revision IS NULL OR p_v3_revision IS NULL
  OR p_legacy_revision<0 OR p_v3_revision<0 THEN RAISE EXCEPTION 'INVALID_CLEAR_REQUEST';END IF;
 req:=jsonb_build_array('tower_all_clear',p_legacy_revision,p_v3_revision);
 -- Same lock order as V2/V3 mutations: legacy account first, V3 state second.
 INSERT INTO private.tower_accounts(user_id) VALUES(uid) ON CONFLICT DO NOTHING;
 INSERT INTO private.tower_v3_state(user_id) VALUES(uid) ON CONFLICT DO NOTHING;
 SELECT revision INTO legacy_rev FROM private.tower_accounts WHERE user_id=uid FOR UPDATE;
 SELECT revision INTO v3_rev FROM private.tower_v3_state WHERE user_id=uid FOR UPDATE;
 SELECT * INTO receipt FROM private.tower_clear_receipts
  WHERE user_id=uid AND operation_id=p_operation_id;
 IF FOUND THEN
  IF receipt.request<>req THEN RAISE EXCEPTION 'OPERATION_ID_REUSED';END IF;
  RETURN receipt.response||jsonb_build_object('replayed',true);
 END IF;
 IF legacy_rev<>p_legacy_revision OR v3_rev<>p_v3_revision THEN
  RAISE EXCEPTION 'REVISION_CONFLICT';
 END IF;
 -- No balances or rewards are changed or refunded by reset.
 UPDATE private.tower_accounts SET elements='[]'::jsonb,revision=revision+1,
  updated_at=now() WHERE user_id=uid RETURNING revision INTO legacy_rev;
 DELETE FROM private.tower_v2_elements WHERE user_id=uid;
 DELETE FROM private.tower_v3_sections WHERE user_id=uid;
 UPDATE private.tower_v3_state SET revision=revision+1,updated_at=now(),reset_at=clock_timestamp()
  WHERE user_id=uid RETURNING revision,reset_at INTO v3_rev,watermark;
 result:=jsonb_build_object('format',3,'revision',v3_rev,'legacyRevision',legacy_rev,
   'resetAt',watermark,'elements','[]'::jsonb);
 INSERT INTO private.tower_clear_receipts(user_id,operation_id,request,response)
  VALUES(uid,p_operation_id,req,result);
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.clear_tower_all(
 p_legacy_revision bigint,p_v3_revision bigint,p_operation_id uuid
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT private.clear_tower_all(p_legacy_revision,p_v3_revision,p_operation_id)
$$;
REVOKE ALL ON FUNCTION private.clear_tower_all(bigint,bigint,uuid),
 public.clear_tower_all(bigint,bigint,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.clear_tower_all(bigint,bigint,uuid),
 public.clear_tower_all(bigint,bigint,uuid) TO authenticated;

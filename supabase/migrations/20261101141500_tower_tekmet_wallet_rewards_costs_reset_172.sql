
-- AlanTil 17.2.52: one Tekmet wallet. All existing user builds are intentionally reset.
-- Shared 3D libraries (including tower_v2_shapes) and learning progress are preserved.
ALTER TABLE private.tower_accounts ADD COLUMN IF NOT EXISTS tekmet bigint NOT NULL DEFAULT 50 CHECK (tekmet>=0);
ALTER TABLE private.tower_v3_sections ADD COLUMN IF NOT EXISTS tekmet_paid integer NOT NULL DEFAULT 0 CHECK (tekmet_paid>=0);
ALTER TABLE private.tower_v3_roofs ADD COLUMN IF NOT EXISTS tekmet_paid integer NOT NULL DEFAULT 0 CHECK (tekmet_paid>=0);
CREATE TABLE IF NOT EXISTS private.tower_tekmet_rewards(
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 word_id text NOT NULL, amount integer NOT NULL CHECK (amount IN (1,2,4)),
 awarded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,word_id)
);
ALTER TABLE private.tower_tekmet_rewards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.tower_tekmet_rewards FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.tower_tekmet_word_value(p_dictionary text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path=''
AS $f$ SELECT CASE p_dictionary WHEN 'beginner' THEN 1 WHEN 'intermediate' THEN 4 WHEN 'thematic' THEN 2 ELSE 0 END $f$;
REVOKE ALL ON FUNCTION private.tower_tekmet_word_value(text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.tower_tekmet_section_cost(p_type text)
RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path=''
AS $f$
DECLARE n integer;
BEGIN
 CASE p_type
 WHEN '1x1x1' THEN RETURN 1;
 WHEN '2x2x2' THEN RETURN 2;
 WHEN '2x2x3' THEN RETURN 3;
 WHEN '2x3x4' THEN RETURN 5;
 WHEN '3x3x3' THEN RETURN 4;
 WHEN '4x4x4' THEN RETURN 8;
 WHEN 'window-4x5x2' THEN RETURN 10;
 WHEN 'door-7x9x2' THEN RETURN 15;
 WHEN 'gate-18x10x2' THEN RETURN 40;
 WHEN 'bagana-2x10x2' THEN RETURN 10;
 ELSE NULL;
 END CASE;
 IF p_type ~ '^bagana-f[123]-3x(9|10|11|12|13)x3$' THEN RETURN 10; END IF;
 IF p_type ~ '^roof-beam-([1-9]|[1-3][0-9]|40)$' THEN
  n:=substring(p_type from '^roof-beam-([0-9]+)$')::integer;
  RETURN (n+1)/2; -- 2 per 1 m, rounded up; 4 grid cells per metre
 END IF;
 RAISE EXCEPTION 'UNKNOWN_TEКMET_ELEMENT';
END $f$;
REVOKE ALL ON FUNCTION private.tower_tekmet_section_cost(text) FROM PUBLIC,anon,authenticated;

-- Every previously rewarded word is preserved as a unique tekmet award.
INSERT INTO private.tower_tekmet_rewards(user_id,word_id,amount)
SELECT r.user_id,r.word_id,private.tower_tekmet_word_value(c.dictionary_id)
 FROM private.tower_word_rewards r
 JOIN public.content_words c ON c.word_id=r.word_id
 WHERE private.tower_tekmet_word_value(c.dictionary_id)>0
ON CONFLICT (user_id,word_id) DO NOTHING;
-- Also include qualifying completed tests that have not yet been synchronized to the old wallet.
WITH qualified AS(
 SELECT w.user_id,w.word_id FROM public.test_session_words w
 JOIN public.test_sessions s ON s.id=w.session_id AND s.user_id=w.user_id
 WHERE w.result='correct' AND s.status='completed'
 UNION
 SELECT w.user_id,w.word_id FROM public.station_test_session_words w
 JOIN public.station_test_sessions s ON s.id=w.session_id AND s.user_id=w.user_id
 WHERE w.result='correct' AND s.status='completed'
)
INSERT INTO private.tower_tekmet_rewards(user_id,word_id,amount)
 SELECT q.user_id,q.word_id,private.tower_tekmet_word_value(c.dictionary_id)
 FROM qualified q JOIN public.content_words c ON c.word_id=q.word_id
 WHERE private.tower_tekmet_word_value(c.dictionary_id)>0
ON CONFLICT (user_id,word_id) DO NOTHING;

-- Make all existing users eligible for the 50 Tekmet grant, not only prior tower visitors.
INSERT INTO private.tower_accounts(user_id) SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
-- Deliberate launch reset: old spent silver/gold is NOT carried forward.
UPDATE private.tower_accounts a SET tekmet=50+COALESCE((
 SELECT sum(r.amount) FROM private.tower_tekmet_rewards r WHERE r.user_id=a.user_id),0),
 silver=0,gold=0,elements='[]'::jsonb,revision=revision+1,updated_at=now();

-- Reset user-generated construction only. Keep shared shape and GLB libraries intact.
DELETE FROM private.tower_v3_roofs;
DELETE FROM private.tower_v3_sections;
DELETE FROM private.tower_v2_elements;
UPDATE private.tower_v3_state SET revision=revision+1,updated_at=now(),reset_at=clock_timestamp();
-- Prior idempotency records must not replay builds from before the launch reset.
DELETE FROM private.tower_v3_roof_receipts;
DELETE FROM private.tower_v3_receipts;
DELETE FROM private.tower_clear_receipts;
DELETE FROM private.tower_receipts;

CREATE OR REPLACE FUNCTION private.tower_refresh_rewards(uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE credited integer:=0;
BEGIN
 WITH qualified AS (
  SELECT w.word_id FROM public.test_session_words w
   JOIN public.test_sessions s ON s.id=w.session_id AND s.user_id=w.user_id
   WHERE w.user_id=uid AND w.result='correct' AND s.status='completed'
  UNION
  SELECT w.word_id FROM public.station_test_session_words w
   JOIN public.station_test_sessions s ON s.id=w.session_id AND s.user_id=w.user_id
   WHERE w.user_id=uid AND w.result='correct' AND s.status='completed'
 ), minted AS(
  INSERT INTO private.tower_tekmet_rewards(user_id,word_id,amount)
  SELECT uid,q.word_id,private.tower_tekmet_word_value(c.dictionary_id)
   FROM qualified q JOIN public.content_words c ON c.word_id=q.word_id
   WHERE private.tower_tekmet_word_value(c.dictionary_id)>0
  ON CONFLICT (user_id,word_id) DO NOTHING RETURNING amount
 )
 SELECT COALESCE(sum(amount),0) INTO credited FROM minted;
 IF credited>0 THEN
  UPDATE private.tower_accounts SET tekmet=tekmet+credited,updated_at=now() WHERE user_id=uid;
 END IF;
END $f$;

CREATE OR REPLACE FUNCTION private.get_tower_v3_snapshot(p_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE uid uuid:=auth.uid();target uuid:=coalesce(p_user_id,auth.uid());rev bigint;watermark timestamptz;money bigint;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
 IF target=uid THEN
  INSERT INTO private.tower_accounts(user_id) VALUES(uid) ON CONFLICT DO NOTHING;
  PERFORM 1 FROM private.tower_accounts WHERE user_id=uid FOR UPDATE;
  PERFORM private.tower_refresh_rewards(uid);
  INSERT INTO private.tower_v3_state(user_id) VALUES(uid) ON CONFLICT DO NOTHING;
  SELECT tekmet INTO money FROM private.tower_accounts WHERE user_id=uid;
 END IF;
 SELECT revision,reset_at INTO rev,watermark FROM private.tower_v3_state WHERE user_id=target;
 RETURN jsonb_build_object('format',3,'revision',COALESCE(rev,0),'resetAt',watermark,
  'elements',private.tower_v3_snapshot_rows(target),'tekmetBalance',money);
END $f$;

CREATE OR REPLACE FUNCTION private.tower_roof_snapshot(uid uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $f$
 SELECT jsonb_build_object(
  'roofs',COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'id',r.id,'level',r.level_cells,'points',r.points,'cells',r.cells,'cost',r.tekmet_paid)
   ORDER BY r.created_at,r.id) FROM private.tower_v3_roofs r WHERE r.user_id=uid),'[]'::jsonb),
  'balance',COALESCE((SELECT a.tekmet FROM private.tower_accounts a WHERE a.user_id=uid),50))
$f$;
CREATE OR REPLACE FUNCTION public.get_tower_roof_snapshot(p_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE uid uuid:=auth.uid();target uuid:=coalesce(p_user_id,auth.uid());snapshot jsonb;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
 IF target=uid THEN
  INSERT INTO private.tower_accounts(user_id) VALUES(uid) ON CONFLICT DO NOTHING;
  PERFORM 1 FROM private.tower_accounts WHERE user_id=uid FOR UPDATE;
  PERFORM private.tower_refresh_rewards(uid);
 END IF;
 snapshot:=private.tower_roof_snapshot(target);
 IF target<>uid THEN snapshot:=jsonb_set(snapshot,'{balance}','null'::jsonb);END IF;
 RETURN snapshot;
END $f$;
REVOKE ALL ON FUNCTION public.get_tower_roof_snapshot(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_tower_roof_snapshot(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.mutate_tower_v3(p_revision bigint,p_operation_id uuid,p_action text,p_section jsonb DEFAULT NULL,p_section_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE uid uuid:=auth.uid();revision_now bigint;receipt private.tower_v3_receipts;request jsonb;
 sections jsonb;candidate jsonb;remaining jsonb;result jsonb;eid uuid;
 price integer:=0;refund integer:=0;balance_now bigint;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
 IF p_revision IS NULL OR p_revision<0 OR p_operation_id IS NULL OR p_action NOT IN ('place','remove') THEN RAISE EXCEPTION 'INVALID_V3_REQUEST';END IF;
 request:=jsonb_build_array('tower_v3',p_revision,p_action,p_section,p_section_id);
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
 sections:=private.tower_v3_snapshot_rows(uid);
 IF p_action='place' THEN
  IF p_section_id IS NOT NULL THEN RAISE EXCEPTION 'INVALID_V3_REQUEST';END IF;
  candidate:=private.tower_v3_canonical(p_section);eid:=(candidate->>'id')::uuid;
  IF EXISTS(SELECT 1 FROM private.tower_v3_sections WHERE user_id=uid AND id=eid) THEN RAISE EXCEPTION 'DUPLICATE_SECTION';END IF;
  IF candidate->>'type'='roof_beam' AND NOT private.tower_v3_beam_has_anchor(sections,candidate) THEN RAISE EXCEPTION 'BEAM_ANCHOR_REQUIRED';END IF;
  remaining:=sections||jsonb_build_array(candidate);
  IF NOT private.tower_v3_valid_layout(uid,remaining) THEN RAISE EXCEPTION 'INVALID_V3_PLACEMENT';END IF;
  price:=private.tower_tekmet_section_cost(candidate->>'sectionId');
  UPDATE private.tower_accounts SET tekmet=tekmet-price WHERE user_id=uid AND tekmet>=price RETURNING tekmet INTO balance_now;
  IF NOT FOUND THEN RAISE EXCEPTION 'INSUFFICIENT_TEKMET';END IF;
  INSERT INTO private.tower_v3_sections(user_id,id,section_id,variant_id,geometry_version,grid_x,grid_y,grid_z,rotation,tekmet_paid)
  VALUES(uid,eid,candidate->>'sectionId',(candidate->>'variant')::smallint,candidate->>'geometryVersion',
   (candidate->>'x')::integer,(candidate->>'y')::integer,(candidate->>'z')::integer,(candidate->>'rotation')::smallint,price);
 ELSE
  IF p_section IS NOT NULL OR p_section_id IS NULL THEN RAISE EXCEPTION 'INVALID_V3_REQUEST';END IF;
  SELECT tekmet_paid INTO refund FROM private.tower_v3_sections WHERE user_id=uid AND id=p_section_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'UNKNOWN_V3_SECTION';END IF;
  SELECT COALESCE(jsonb_agg(value),'[]'::jsonb) INTO remaining
   FROM jsonb_array_elements(sections) x WHERE x.value->>'id'<>p_section_id::text;
  IF NOT private.tower_v3_valid_layout(uid,remaining) THEN RAISE EXCEPTION 'SUPPORT_REQUIRED';END IF;
  DELETE FROM private.tower_v3_sections WHERE user_id=uid AND id=p_section_id;
  UPDATE private.tower_accounts SET tekmet=tekmet+refund WHERE user_id=uid RETURNING tekmet INTO balance_now;
 END IF;
 UPDATE private.tower_v3_state SET revision=revision+1,updated_at=now() WHERE user_id=uid;
 result:=jsonb_build_object('format',3,'revision',revision_now+1,'elements',
  private.tower_v3_snapshot_rows(uid),'tekmetBalance',balance_now,'charged',price,'refunded',refund);
 INSERT INTO private.tower_v3_receipts(user_id,operation_id,request,response) VALUES(uid,p_operation_id,request,result);
 RETURN result;
END $f$;

CREATE OR REPLACE FUNCTION private.mutate_tower_roof(p_operation_id uuid,p_points jsonb,p_level integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE uid uuid:=auth.uid();receipt private.tower_v3_roof_receipts;
 request jsonb;cells jsonb;amount integer;cell jsonb;section jsonb;sections jsonb;
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
 cells:=private.tower_roof_cells(p_points);
 amount:=jsonb_array_length(cells)*2;
 IF amount<2 OR amount>14400 THEN RAISE EXCEPTION 'INVALID_ROOF_AREA';END IF;
 sections:=private.tower_v3_snapshot_rows(uid);
 FOR cell IN SELECT value FROM jsonb_array_elements(cells) LOOP
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
  AND c.value IN (SELECT value FROM jsonb_array_elements(cells)))
 THEN RAISE EXCEPTION 'ROOF_OVERLAP';END IF;
 UPDATE private.tower_accounts SET tekmet=tekmet-amount
  WHERE user_id=uid AND tekmet>=amount RETURNING tekmet INTO balance_now;
 IF NOT FOUND THEN RAISE EXCEPTION 'INSUFFICIENT_TEKMET';END IF;
 INSERT INTO private.tower_v3_roofs(user_id,id,level_cells,points,cells,cell_count,cost_silver,tekmet_paid)
 VALUES(uid,p_operation_id,p_level,p_points,cells,jsonb_array_length(cells),0,amount);
 INSERT INTO private.tower_v3_roof_receipts(user_id,operation_id,request,response)
 VALUES(uid,p_operation_id,request,private.tower_roof_snapshot(uid));
 RETURN private.tower_roof_snapshot(uid);
END $f$;

CREATE OR REPLACE FUNCTION private.remove_tower_roof(p_operation_id uuid,p_roof_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE uid uuid:=auth.uid();receipt private.tower_v3_roof_receipts;request jsonb;refund integer;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
 IF p_operation_id IS NULL OR p_roof_id IS NULL THEN RAISE EXCEPTION 'INVALID_ROOF_REQUEST';END IF;
 request:=jsonb_build_array('roof_remove_v1',p_roof_id);
 INSERT INTO private.tower_accounts(user_id) VALUES(uid) ON CONFLICT DO NOTHING;
 PERFORM 1 FROM private.tower_accounts WHERE user_id=uid FOR UPDATE;
 INSERT INTO private.tower_v3_state(user_id) VALUES(uid) ON CONFLICT DO NOTHING;
 PERFORM 1 FROM private.tower_v3_state WHERE user_id=uid FOR UPDATE;
 SELECT * INTO receipt FROM private.tower_v3_roof_receipts WHERE user_id=uid AND operation_id=p_operation_id;
 IF FOUND THEN
  IF receipt.request<>request THEN RAISE EXCEPTION 'OPERATION_ID_REUSED';END IF;
  RETURN receipt.response||jsonb_build_object('replayed',true);
 END IF;
 SELECT tekmet_paid INTO refund FROM private.tower_v3_roofs WHERE user_id=uid AND id=p_roof_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'UNKNOWN_ROOF';END IF;
 DELETE FROM private.tower_v3_roofs WHERE user_id=uid AND id=p_roof_id;
 UPDATE private.tower_accounts SET tekmet=tekmet+refund WHERE user_id=uid;
 INSERT INTO private.tower_v3_roof_receipts(user_id,operation_id,request,response)
 VALUES(uid,p_operation_id,request,private.tower_roof_snapshot(uid));
 RETURN private.tower_roof_snapshot(uid);
END $f$;
REVOKE ALL ON FUNCTION private.remove_tower_roof(uuid,uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.remove_tower_roof(p_operation_id uuid,p_roof_id uuid)
RETURNS jsonb LANGUAGE sql SET search_path=''
AS $f$ SELECT private.remove_tower_roof(p_operation_id,p_roof_id) $f$;
REVOKE ALL ON FUNCTION public.remove_tower_roof(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.remove_tower_roof(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.clear_tower_v3(p_revision bigint,p_operation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE uid uuid:=auth.uid();current_revision bigint;receipt private.tower_v3_receipts;
 request jsonb;result jsonb;watermark timestamptz;refund bigint:=0;balance_now bigint;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
 IF p_revision IS NULL OR p_revision<0 OR p_operation_id IS NULL THEN RAISE EXCEPTION 'INVALID_CLEAR_REQUEST';END IF;
 request:=jsonb_build_array('tower_v3_clear',p_revision);
 INSERT INTO private.tower_accounts(user_id) VALUES(uid) ON CONFLICT DO NOTHING;
 PERFORM 1 FROM private.tower_accounts WHERE user_id=uid FOR UPDATE;
 INSERT INTO private.tower_v3_state(user_id) VALUES(uid) ON CONFLICT DO NOTHING;
 SELECT revision INTO current_revision FROM private.tower_v3_state WHERE user_id=uid FOR UPDATE;
 SELECT * INTO receipt FROM private.tower_v3_receipts WHERE user_id=uid AND operation_id=p_operation_id;
 IF FOUND THEN
  IF receipt.request<>request THEN RAISE EXCEPTION 'OPERATION_ID_REUSED';END IF;
  RETURN receipt.response||jsonb_build_object('replayed',true);
 END IF;
 IF current_revision<>p_revision THEN RAISE EXCEPTION 'REVISION_CONFLICT';END IF;
 SELECT COALESCE(sum(tekmet_paid),0) INTO refund FROM (
  SELECT tekmet_paid FROM private.tower_v3_sections WHERE user_id=uid
  UNION ALL SELECT tekmet_paid FROM private.tower_v3_roofs WHERE user_id=uid
 ) paid;
 DELETE FROM private.tower_v3_roofs WHERE user_id=uid;
 DELETE FROM private.tower_v3_sections WHERE user_id=uid;
 UPDATE private.tower_accounts SET tekmet=tekmet+refund WHERE user_id=uid RETURNING tekmet INTO balance_now;
 watermark:=clock_timestamp();
 UPDATE private.tower_v3_state SET revision=revision+1,updated_at=now(),reset_at=watermark WHERE user_id=uid;
 result:=jsonb_build_object('format',3,'revision',current_revision+1,'resetAt',watermark,'elements',
  '[]'::jsonb,'tekmetBalance',balance_now,'refunded',refund);
 INSERT INTO private.tower_v3_receipts(user_id,operation_id,request,response)
 VALUES(uid,p_operation_id,request,result);
 RETURN result;
END $f$;

-- Keep older clear RPC semantics but return all paid construction Tekmets.
CREATE OR REPLACE FUNCTION private.clear_tower_all(p_legacy_revision bigint,p_v3_revision bigint,p_operation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE uid uuid:=auth.uid();legacy_revision bigint;current_revision bigint;receipt private.tower_clear_receipts;
 request jsonb;result jsonb;watermark timestamptz;refund bigint:=0;balance_now bigint;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
 IF p_operation_id IS NULL OR p_legacy_revision IS NULL OR p_v3_revision IS NULL
  OR p_legacy_revision<0 OR p_v3_revision<0 THEN RAISE EXCEPTION 'INVALID_CLEAR_REQUEST';END IF;
 request:=jsonb_build_array('tower_all_clear',p_legacy_revision,p_v3_revision);
 INSERT INTO private.tower_accounts(user_id) VALUES(uid) ON CONFLICT DO NOTHING;
 INSERT INTO private.tower_v3_state(user_id) VALUES(uid) ON CONFLICT DO NOTHING;
 SELECT revision INTO legacy_revision FROM private.tower_accounts WHERE user_id=uid FOR UPDATE;
 SELECT revision INTO current_revision FROM private.tower_v3_state WHERE user_id=uid FOR UPDATE;
 SELECT * INTO receipt FROM private.tower_clear_receipts WHERE user_id=uid AND operation_id=p_operation_id;
 IF FOUND THEN
  IF receipt.request<>request THEN RAISE EXCEPTION 'OPERATION_ID_REUSED';END IF;
  RETURN receipt.response||jsonb_build_object('replayed',true);
 END IF;
 IF legacy_revision<>p_legacy_revision OR current_revision<>p_v3_revision THEN RAISE EXCEPTION 'REVISION_CONFLICT';END IF;
 SELECT COALESCE(sum(tekmet_paid),0) INTO refund FROM (
  SELECT tekmet_paid FROM private.tower_v3_sections WHERE user_id=uid
  UNION ALL SELECT tekmet_paid FROM private.tower_v3_roofs WHERE user_id=uid
 ) paid;
 DELETE FROM private.tower_v3_roofs WHERE user_id=uid;
 DELETE FROM private.tower_v3_sections WHERE user_id=uid;
 DELETE FROM private.tower_v2_elements WHERE user_id=uid;
 UPDATE private.tower_accounts SET tekmet=tekmet+refund,elements='[]'::jsonb,
   revision=revision+1,updated_at=now() WHERE user_id=uid
   RETURNING revision,tekmet INTO legacy_revision,balance_now;
 watermark:=clock_timestamp();
 UPDATE private.tower_v3_state SET revision=revision+1,updated_at=now(),reset_at=watermark WHERE user_id=uid;
 result:=jsonb_build_object('format',3,'revision',current_revision+1,'legacyRevision',legacy_revision,
  'resetAt',watermark,'elements','[]'::jsonb,'tekmetBalance',balance_now,'refunded',refund);
 INSERT INTO private.tower_clear_receipts(user_id,operation_id,request,response)
 VALUES(uid,p_operation_id,request,result);
 RETURN result;
END $f$;

-- Retire obsolete silver/gold mutation endpoints to prevent bypassing the new wallet.
CREATE OR REPLACE FUNCTION private.mutate_tower(p_revision bigint,p_operation_id uuid,p_action text,p_element jsonb DEFAULT NULL,p_element_id uuid DEFAULT NULL,p_currency text DEFAULT 'silver')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$ BEGIN RAISE EXCEPTION 'LEGACY_TOWER_DISABLED';END $f$;
CREATE OR REPLACE FUNCTION private.mutate_tower_v2(p_revision bigint,p_operation_id uuid,p_action text,p_element jsonb DEFAULT NULL,p_element_id uuid DEFAULT NULL,p_currency text DEFAULT 'silver')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$ BEGIN RAISE EXCEPTION 'LEGACY_TOWER_DISABLED';END $f$;

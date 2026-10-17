\set ON_ERROR_STOP on
-- CI baseline fixture omits this V1 column, but production has it.
ALTER TABLE private.tower_accounts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
-- Isolated transactional exercise against tower_v3_fixture.sql + tower migrations.
INSERT INTO private.tower_v3_state(user_id) VALUES('11111111-1111-4111-8111-111111111111') ON CONFLICT DO NOTHING;
UPDATE private.tower_accounts SET elements='[["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","stone",0,0,0,1,1,1,0,0,"silver",1]]'::jsonb
 WHERE user_id='11111111-1111-4111-8111-111111111111';
INSERT INTO private.tower_v2_elements(user_id,id,data) VALUES
 ('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','{}'::jsonb);
INSERT INTO private.tower_v3_sections(user_id,id,section_id,variant_id,geometry_version,grid_x,grid_y,grid_z,rotation)
 VALUES('11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-cccccccccccc','1x1x1',0,'17.5.5',0,0,0,0);
SET ROLE authenticated;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
DO $$
DECLARE v jsonb; op uuid:='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
BEGIN
 v:=public.clear_tower_all(0,0,op);
 IF v->>'format'<>'3' OR v->>'legacyRevision'<>'1' OR v->>'revision'<>'1'
  OR v->>'resetAt' IS NULL OR v->'elements'<>'[]'::jsonb
  THEN RAISE EXCEPTION 'INVALID_RESET_SNAPSHOT: %',v;END IF;
 v:=public.clear_tower_all(0,0,op);
 IF v->>'replayed'<>'true' THEN RAISE EXCEPTION 'REPLAY_NOT_IDEMPOTENT';END IF;
 BEGIN
  PERFORM public.clear_tower_all(0,0,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
  RAISE EXCEPTION 'STALE_REVISION_ACCEPTED';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'REVISION_CONFLICT' THEN RAISE;END IF;
 END;
END $$;
RESET ROLE;
DO $$
BEGIN
 IF (SELECT jsonb_array_length(elements) FROM private.tower_accounts
     WHERE user_id='11111111-1111-4111-8111-111111111111')<>0
  OR (SELECT count(*) FROM private.tower_v2_elements WHERE user_id='11111111-1111-4111-8111-111111111111')<>0
  OR (SELECT count(*) FROM private.tower_v3_sections WHERE user_id='11111111-1111-4111-8111-111111111111')<>0
  THEN RAISE EXCEPTION 'RESET_LEFT_GEOMETRY';END IF;
 IF (SELECT silver FROM private.tower_accounts WHERE user_id='11111111-1111-4111-8111-111111111111')<>35
  OR (SELECT gold FROM private.tower_accounts WHERE user_id='11111111-1111-4111-8111-111111111111')<>4
  THEN RAISE EXCEPTION 'WALLET_CHANGED';END IF;
 IF (SELECT silver FROM private.tower_accounts WHERE user_id='22222222-2222-4222-8222-222222222222')<>60
  THEN RAISE EXCEPTION 'OTHER_USER_CHANGED';END IF;
END $$;

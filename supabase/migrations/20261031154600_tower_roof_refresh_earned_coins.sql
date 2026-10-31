
-- On opening the roof tool, mint any previously earned word rewards before quoting spendable silver.
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
 IF target<>uid THEN snapshot:=jsonb_set(snapshot,'{balance}','0'::jsonb);END IF;
 RETURN snapshot;
END $f$;
REVOKE ALL ON FUNCTION public.get_tower_roof_snapshot(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_tower_roof_snapshot(uuid) TO authenticated;

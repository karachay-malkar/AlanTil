-- Public RPCs run with the database function owner's rights.
-- Browser roles cannot execute private roof functions directly.
CREATE OR REPLACE FUNCTION public.mutate_tower_roof(p_operation_id uuid,p_points jsonb,p_level integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
 RETURN private.mutate_tower_roof(p_operation_id,p_points,p_level);
END $f$;
CREATE OR REPLACE FUNCTION public.remove_tower_roof(p_operation_id uuid,p_roof_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
 RETURN private.remove_tower_roof(p_operation_id,p_roof_id);
END $f$;
REVOKE ALL ON FUNCTION public.mutate_tower_roof(uuid,jsonb,integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.remove_tower_roof(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mutate_tower_roof(uuid,jsonb,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_tower_roof(uuid,uuid) TO authenticated;

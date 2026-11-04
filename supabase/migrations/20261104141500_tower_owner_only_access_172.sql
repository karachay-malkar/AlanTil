-- AlanTil 17.2.71: temporarily restrict the 3D Tower game to its verified owner.
-- Only the verified auth.users ID is trusted; nicknames can be edited.
-- Existing tower rows, coins, users and other app features are not modified.
DO $tower_access$
DECLARE
 allowed_user constant uuid:='dfcf124e-735b-4caa-81d2-99eb5f02218d'::uuid;
 fn record;
 definition text;
 prefix text;
 body text;
 replacement text;
 delimiter_pos integer;
 patched integer:=0;
BEGIN
 IF (SELECT count(*) FROM public.profiles p
     WHERE p.user_id=allowed_user AND p.nickname='as_alan')<>1
 THEN RAISE EXCEPTION 'Tower owner identity not verified'; END IF;
 FOR fn IN
  SELECT p.oid,n.nspname,p.proname
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  JOIN pg_language lang ON lang.oid=p.prolang
  WHERE lang.lanname='plpgsql'
    AND (
      (n.nspname='private' AND p.proname IN (
        'clear_tower_all','clear_tower_v3','get_tower_snapshot',
        'get_tower_v2_geometry','get_tower_v2_snapshot','get_tower_v3_snapshot',
        'mutate_tower','mutate_tower_roof','mutate_tower_v2','mutate_tower_v3',
        'mutate_tower_v3_line','remove_tower_roof','remove_tower_v3_sections'))
      OR (n.nspname='public' AND p.proname='get_tower_roof_snapshot')
    )
  ORDER BY n.nspname,p.proname
 LOOP
  definition:=pg_get_functiondef(fn.oid);
  IF position('TOWER_ACCESS_RESTRICTED' IN definition)>0 THEN
   patched:=patched+1;CONTINUE;
  END IF;
  delimiter_pos:=position('AS $function$' IN definition);
  IF delimiter_pos=0 THEN RAISE EXCEPTION 'Unexpected function source %',fn.proname;END IF;
  delimiter_pos:=delimiter_pos+length('AS $function$');
  prefix:=substring(definition FROM 1 FOR delimiter_pos-1);
  body:=substring(definition FROM delimiter_pos);
  replacement:=regexp_replace(
    body,
    '\mbegin\M',
    'BEGIN
 IF auth.uid() IS DISTINCT FROM ''dfcf124e-735b-4caa-81d2-99eb5f02218d''::uuid THEN
  RAISE EXCEPTION ''TOWER_ACCESS_RESTRICTED'' USING ERRCODE=''42501'';
 END IF;',
    'i'
  );
  IF replacement=body THEN RAISE EXCEPTION 'Cannot find body BEGIN in %',fn.proname;END IF;
  EXECUTE prefix||replacement;
  patched:=patched+1;
 END LOOP;
 IF patched<>14 THEN RAISE EXCEPTION 'Unexpected tower API count: % (wanted 14)',patched;END IF;
END $tower_access$;

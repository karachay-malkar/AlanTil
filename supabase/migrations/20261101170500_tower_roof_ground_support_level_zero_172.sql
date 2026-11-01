-- Allow roofs at ground level without supports, retaining collisions and higher roof support checks.
DO $patch$
DECLARE source text;
BEGIN
 SELECT pg_get_functiondef('private.mutate_tower_roof(uuid,jsonb,integer)'::regprocedure) INTO source;
 IF position('supported:=(p_level=0)' IN source)>0 THEN RETURN; END IF;
 IF position('x:=(cell->>0)::integer;z:=(cell->>1)::integer;supported:=false;' IN source)=0
 THEN RAISE EXCEPTION 'Unexpected roof support validator'; END IF;
 source:=replace(source,
  'x:=(cell->>0)::integer;z:=(cell->>1)::integer;supported:=false;',
  'x:=(cell->>0)::integer;z:=(cell->>1)::integer;supported:=(p_level=0);');
 EXECUTE source;
END $patch$;

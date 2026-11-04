-- Roof cost per 25-cm cell: 1 tekmet, preserve historical receipts and refunds.
DO $$
DECLARE definition text;replacement text;
BEGIN
 definition:=pg_get_functiondef('private.mutate_tower_roof(uuid,jsonb,integer)'::regprocedure);
 IF position('amount:=jsonb_array_length(new_cells)*2;' in definition)=0
  OR position('IF amount<2 OR amount>14400' in definition)=0
 THEN RAISE EXCEPTION 'Unexpected roof pricing function source; migration aborted';END IF;
 replacement:=replace(definition,'amount:=jsonb_array_length(new_cells)*2;','amount:=jsonb_array_length(new_cells);');
 replacement:=replace(replacement,'IF amount<2 OR amount>14400','IF amount<1 OR amount>7200');
 EXECUTE replacement;
END $$;

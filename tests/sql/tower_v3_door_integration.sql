\set ON_ERROR_STOP on
-- Preserve all historic/window versions; only door-7x9x2 with variant 0 is new.
do $$declare d jsonb;
begin
 d:=jsonb_build_object('id','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','sectionId','door-7x9x2',
 'variant',0,'rotation',0,'x',10,'y',0,'z',10,'geometryVersion','17.6-door.1');
 if private.tower_v3_size('door-7x9x2',0)<>ARRAY[7,9,2] or
    private.tower_v3_size('door-7x9x2',1)<>ARRAY[2,9,7] then raise exception 'DOOR_SIZE_MISMATCH';end if;
 perform private.tower_v3_canonical(d);
 perform private.tower_v3_canonical(jsonb_set(d,'{rotation}','3'::jsonb));
 begin
  perform private.tower_v3_canonical(jsonb_set(d,'{variant}','1'::jsonb));
  raise exception 'BAD_DOOR_VARIANT_ACCEPTED';
 exception when others then if sqlerrm not like '%INVALID_V3_SECTION%' then raise;end if;end;
 begin
  perform private.tower_v3_canonical(jsonb_set(d,'{geometryVersion}','"17.5.2"'::jsonb));
  raise exception 'BAD_DOOR_VERSION_ACCEPTED';
 exception when others then if sqlerrm not like '%INVALID_V3_SECTION%' then raise;end if;end;
 -- Window 17.6 and old ordinary sections remain loadable.
 perform private.tower_v3_canonical(jsonb_build_object('id','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
 'sectionId','window-4x5x2','variant',0,'rotation',0,'x',1,'y',0,'z',1,'geometryVersion','17.6-window.1'));
 perform private.tower_v3_canonical(jsonb_build_object('id','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
 'sectionId','2x2x2','variant',7,'rotation',0,'x',1,'y',0,'z',1,'geometryVersion','17.5.1'));
end$$;
select 'TOWER_V3_DOOR_SQL_QA_OK' as result;

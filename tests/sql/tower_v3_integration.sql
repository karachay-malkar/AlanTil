\set ON_ERROR_STOP on
set role authenticated;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $$declare a jsonb; s jsonb;
begin
 a:=public.get_tower_v3_snapshot(null);
 if a->>'format'<>'3' or a->>'revision'<>'0' or jsonb_array_length(a->'elements')<>0 then raise exception 'INITIAL_SNAPSHOT';end if;
 s:=jsonb_build_object('id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','type','masonry_section','sectionId','2x2x2','variant',0,'rotation',0,'x',0,'y',0,'z',0,'geometryVersion','17.5.0');
 a:=public.mutate_tower_v3(0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','place',s,null);
 if a->>'revision'<>'1' or jsonb_array_length(a->'elements')<>1 then raise exception 'PLACE_FAILED';end if;
 a:=public.mutate_tower_v3(0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','place',s,null);
 if a->>'replayed'<>'true' then raise exception 'IDEMPOTENCY_FAILED';end if;
 begin
  perform public.mutate_tower_v3(0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','place',s,null);
  raise exception 'SHOULD_FAIL_STALE_REVISION';
 exception when others then if sqlerrm not like '%REVISION_CONFLICT%' then raise;end if;end;
 begin
  perform public.mutate_tower_v3(1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','place',jsonb_set(s,'{x}','1'),null);
  raise exception 'SHOULD_FAIL_COLLISION';
 exception when others then if sqlerrm not like '%INVALID_V3_PLACEMENT%' then raise;end if;end;
 begin
  perform public.mutate_tower_v3(1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','place',jsonb_set(s,'{x}','1.1'),null);
  raise exception 'SHOULD_FAIL_OFFGRID';
 exception when others then if sqlerrm not like '%GRID_REQUIRED%' then raise;end if;end;
 s:=jsonb_build_object('id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','sectionId','2x2x2','variant',0,'rotation',0,'x',0,'y',2,'z',0,'geometryVersion','17.5.0');
 a:=public.mutate_tower_v3(1,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','place',s,null);
 if a->>'revision'<>'2' then raise exception 'STACK_FAILED';end if;
 begin
  perform public.mutate_tower_v3(2,'cccccccc-cccc-4ccc-8ccc-ccccccccccc3','remove',null,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1');
  raise exception 'SHOULD_REFUSE_SUPPORT_REMOVAL';
 exception when others then if sqlerrm not like '%SUPPORT_REQUIRED%' then raise;end if;end;
 a:=public.mutate_tower_v3(2,'dddddddd-dddd-4ddd-8ddd-ddddddddddd4','remove',null,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2');
 if a->>'revision'<>'3' then raise exception 'REMOVE_FAILED';end if;
 if jsonb_array_length(a->'elements')<>1 then raise exception 'WRONG_REMAINING';end if;
end$$;
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
do $$begin
 begin
  perform public.mutate_tower_v3(0,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5','remove',null,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1');
  raise exception 'SHOULD_REFUSE_CROSS_USER_DELETE';
 exception when others then if sqlerrm not like '%UNKNOWN_V3_SECTION%' then raise;end if;end;
end$$;
reset role;
do $$begin
 if (select silver from private.tower_accounts where user_id='11111111-1111-4111-8111-111111111111')<>35 then raise exception 'WALLET_CHANGED';end if;
 if (select count(*) from private.tower_v3_sections where user_id='11111111-1111-4111-8111-111111111111')<>1 then raise exception 'ROW_COUNT_CHANGED';end if;
end$$;
select 'TOWER_V3_SERVER_QA_OK' as result;

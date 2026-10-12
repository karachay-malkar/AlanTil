\set ON_ERROR_STOP on
set role authenticated;
set "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';
-- Real authored Rock004 medium source; ground placement must pass.
select public.get_tower_v2_snapshot(null);
DO $$
declare s jsonb;
begin
 s:=public.mutate_tower_v2(0,'10000000-0000-0000-0000-000000000001','place',
  '{"id":"20000000-0000-0000-0000-000000000001","type":"medium","x":20,"y":0,"z":20,"sx":2,"sy":1,"sz":1,"rotation":0,"variant":0}'::jsonb,null,'silver');
 if s->>'revision'<>'1' or s->>'silver'<>'196' or jsonb_array_length(s->'elements')<>1 then raise exception 'V2_GROUND_SAVE_FAILED: %',s;end if;
 if s->'elements'->0->>'id'<>'20000000-0000-0000-0000-000000000001' then raise exception 'WRONG_SAVED_ELEMENT';end if;
end $$;
DO $$
declare s jsonb;
begin
 s:=public.mutate_tower_v2(0,'10000000-0000-0000-0000-000000000001','place',
  '{"id":"20000000-0000-0000-0000-000000000001","type":"medium","x":20,"y":0,"z":20,"sx":2,"sy":1,"sz":1,"rotation":0,"variant":0}'::jsonb,null,'silver');
 if s->>'revision'<>'1' or s->>'silver'<>'196' or s->>'replayed'<>'true' then raise exception 'IDEMPOTENCY_FAILED %',s;end if;
end $$;
-- The same old revision must not be accepted as a fresh operation.
DO $$begin
 begin
  perform public.mutate_tower_v2(0,'10000000-0000-0000-0000-000000000002','place',
  '{"id":"20000000-0000-0000-0000-000000000002","type":"medium","x":30,"y":0,"z":30,"sx":2,"sy":1,"sz":1,"rotation":0,"variant":0}'::jsonb,null,'silver');
  raise exception 'STALE_REVISION_ACCEPTED';
 exception when raise_exception then if sqlerrm<>'REVISION_CONFLICT' then raise;end if;end;
end $$;
DO $$begin
 begin
  perform public.mutate_tower_v2(1,'10000000-0000-0000-0000-000000000003','place',
  '{"id":"20000000-0000-0000-0000-000000000002","type":"medium","x":20,"y":0,"z":20,"sx":2,"sy":1,"sz":1,"rotation":0,"variant":0}'::jsonb,null,'silver');
  raise exception 'OVERLAPPING_STONE_ACCEPTED';
 exception when raise_exception then if sqlerrm<>'INVALID_PLACEMENT_OR_SUPPORT' then raise;end if;end;
end $$;
-- A real secondary stone supported by authored triangles above the first.
DO $$
declare s jsonb;
begin
 s:=public.mutate_tower_v2(1,'10000000-0000-0000-0000-000000000004','place',
  '{"id":"20000000-0000-0000-0000-000000000004","type":"medium","x":19.97933,"y":1.00060,"z":19.96866,"sx":2,"sy":1,"sz":1,"rotation":0,"variant":0}'::jsonb,null,'silver');
 if s->>'revision'<>'2' or jsonb_array_length(s->'elements')<>2 then raise exception 'STACK_PLACEMENT_FAILED %',s;end if;
end $$;
DO $$begin
 begin
  perform public.mutate_tower_v2(2,'10000000-0000-0000-0000-000000000005','remove',null,'20000000-0000-0000-0000-000000000001','silver');
  raise exception 'REMOVED_SUPPORTING_STONE';
 exception when raise_exception then if sqlerrm<>'DEPENDENT_ELEMENTS_REQUIRE_REMOVAL' then raise;end if;end;
end $$;
-- Remove upper first and then lower, returning payment and preserving V1.
DO $$declare s jsonb;
begin
 s:=public.mutate_tower_v2(2,'10000000-0000-0000-0000-000000000006','remove',null,'20000000-0000-0000-0000-000000000004','silver');
 if s->>'silver'<>'196' then raise exception 'REFUND_UPPER_FAILED %',s;end if;
 s:=public.mutate_tower_v2(3,'10000000-0000-0000-0000-000000000007','remove',null,'20000000-0000-0000-0000-000000000001','silver');
 if s->>'silver'<>'200' or s->>'revision'<>'4' or jsonb_array_length(s->'elements')<>0 then raise exception 'REFUND_LOWER_FAILED %',s;end if;
end $$;
-- Owner scoping: second user cannot mutate first user's stone by ID.
set "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000002';
DO $$begin
 begin
  perform public.mutate_tower_v2(0,'10000000-0000-0000-0000-000000000008','remove',null,'20000000-0000-0000-0000-000000000001','silver');
  raise exception 'CROSS_USER_REMOVAL_ACCEPTED';
 exception when raise_exception then if sqlerrm<>'ELEMENT_NOT_FOUND' then raise;end if;end;
end $$;
reset role;
DO $$declare elem jsonb;v bigint;begin
 select elements,revision into elem,v from private.tower_accounts where user_id='00000000-0000-0000-0000-000000000001';
 if elem->0->>0<>'legacy-unchanged' or v<>4 then raise exception 'LEGACY_TOWER_CHANGED';end if;
 if (select count(*) from private.tower_v2_elements)>0 then raise exception 'V2_ITEMS_NOT_REMOVED';end if;
end $$;
\echo TOWER_V2_POSTGRES_INTEGRATION_OK
-- Bounded 5 x 5 foundation test: 25 purchases using the existing wallet,
-- no pairs inside each other's physical envelope, all 25 server-authorized.
set role authenticated;
set "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000002';
DO $$declare i int;ex int;ez int;eid uuid;opid uuid;result jsonb;
begin
 for i in 0..24 loop
  ex:=2+(i%5)*7;ez:=2+(i/5)*7;
  eid:=('30000000-0000-0000-0000-'||lpad((i+1)::text,12,'0'))::uuid;
  opid:=('40000000-0000-0000-0000-'||lpad((i+1)::text,12,'0'))::uuid;
  result:=public.mutate_tower_v2(i,opid,'place',
    jsonb_build_object('id',eid,'type','medium','x',ex,'y',0,'z',ez,
      'sx',2,'sy',1,'sz',1,'rotation',0,'variant',0),null,'silver');
  if (result->>'revision')::int<>i+1 or (result->>'silver')::int<>100-(i+1)*4 then
   raise exception 'FOUNDATION_WALLET_OR_REVISION_INVALID % %',i,result;
  end if;
 end loop;
 if jsonb_array_length(result->'elements')<>25 then raise exception 'FOUNDATION_25_COUNT_MISMATCH';end if;
end $$;
reset role;
\echo TOWER_V2_25_FOUNDATION_STONES_OK

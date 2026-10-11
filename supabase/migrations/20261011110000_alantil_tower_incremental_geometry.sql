-- Incremental geometry validation; assumes stored snapshot was validated by tower RPCs.
create function private.tower_world_element(e jsonb) returns jsonb language sql immutable set search_path='' as $$
select jsonb_set(jsonb_set(jsonb_set(e,'{5}',case when (e->>8)::int=4 then e->6 when (e->>8)::int%2=1 and (e->>8)::int<4 then e->7 else e->5 end),'{6}',case when (e->>8)::int=4 then e->5 when (e->>8)::int=5 then e->7 else e->6 end),'{7}',case when (e->>8)::int=5 then e->6 when (e->>8)::int%2=1 and (e->>8)::int<4 then e->5 else e->7 end)
$$;

-- items and element are world-oriented. Filter support candidates once, not once per cell.
create function private.tower_element_supported(items jsonb,e jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare x int:=(e->>2)::int;y int:=(e->>3)::int;z int:=(e->>4)::int;dx int:=(e->>5)::int;dz int:=(e->>7)::int;cx int;cz int;supports jsonb;bridge boolean:=e->>1 in ('long','beam','deck','roof');
begin
 if y=0 then return true;end if;
 select coalesce(jsonb_agg(q),'[]') into supports from jsonb_array_elements(items) q where q->>0<>e->>0 and q->>1 not in ('window','door','ladder','roof') and (q->>3)::int+(q->>6)::int=y and x<(q->>2)::int+(q->>5)::int and x+dx>(q->>2)::int and z<(q->>4)::int+(q->>7)::int and z+dz>(q->>4)::int;
 if jsonb_array_length(supports)=0 then return false;end if;
 for cx in x..x+dx-1 loop for cz in z..z+dz-1 loop
 if not bridge or (dx>=dz and cx in (x,x+dx-1)) or (dx<dz and cz in (z,z+dz-1)) then
 if not exists(select 1 from jsonb_array_elements(supports) q where cx>=(q->>2)::int and cx<(q->>2)::int+(q->>5)::int and cz>=(q->>4)::int and cz<(q->>4)::int+(q->>7)::int) then return false;end if;
 end if;end loop;end loop;
 return true;
end $$;

create function private.tower_place_valid(items jsonb,e jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare w jsonb:=private.tower_world_element(e);world_items jsonb;x int;y int;z int;dx int;dy int;dz int;
begin
 x:=(w->>2)::int;y:=(w->>3)::int;z:=(w->>4)::int;dx:=(w->>5)::int;dy:=(w->>6)::int;dz:=(w->>7)::int;
 if x<0 or y<0 or z<0 or dx<1 or dy<1 or dz<1 or x+dx>60 or z+dz>60 or y+dy>80 then return false;end if;
 select coalesce(jsonb_agg(private.tower_world_element(q)),'[]') into world_items from jsonb_array_elements(items) q;
 if exists(select 1 from jsonb_array_elements(world_items) q where x<(q->>2)::int+(q->>5)::int and x+dx>(q->>2)::int and y<(q->>3)::int+(q->>6)::int and y+dy>(q->>3)::int and z<(q->>4)::int+(q->>7)::int and z+dz>(q->>4)::int) then return false;end if;
 return private.tower_element_supported(world_items,w);
end $$;

create function private.tower_remove_valid(remaining jsonb,removed jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare w jsonb:=private.tower_world_element(removed);world_items jsonb;q jsonb;
begin
 if w->>1 in ('window','door','ladder','roof') then return true;end if;
 select coalesce(jsonb_agg(private.tower_world_element(e)),'[]') into world_items from jsonb_array_elements(remaining) e;
 for q in select value from jsonb_array_elements(world_items) where (value->>3)::int=(w->>3)::int+(w->>6)::int and (value->>2)::int<(w->>2)::int+(w->>5)::int and (value->>2)::int+(value->>5)::int>(w->>2)::int and (value->>4)::int<(w->>4)::int+(w->>7)::int and (value->>4)::int+(value->>7)::int>(w->>4)::int loop
 if not private.tower_element_supported(world_items,q) then return false;end if;
 end loop;
 return true;
end $$;
create or replace function private.mutate_tower(p_revision bigint,p_operation_id uuid,p_action text,p_element jsonb default null,p_element_id uuid default null,p_currency text default 'silver') returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); a private.tower_accounts; receipt private.tower_receipts; req jsonb; result jsonb; e jsonb; items jsonb; typ text; cost int; paid int; dx int; dy int; dz int; rot int; canonical_x int; canonical_z int; valid boolean; eid uuid;
begin
 if uid is null then raise exception 'AUTH_REQUIRED';end if;
 if p_operation_id is null or p_revision is null then raise exception 'INVALID_REQUEST';end if;
 req:=jsonb_build_array(p_revision,p_action,p_element,p_element_id,p_currency);
 insert into private.tower_accounts(user_id) values(uid) on conflict do nothing;
 select * into a from private.tower_accounts where user_id=uid for update;
 select * into receipt from private.tower_receipts where user_id=uid and operation_id=p_operation_id;
 if found then if receipt.request<>req then raise exception 'OPERATION_ID_REUSED';end if;return jsonb_build_object('revision',a.revision,'silver',a.silver,'gold',a.gold,'elements',a.elements,'reward_mapping_version',1,'replayed',true);end if;
 if a.revision<>p_revision then raise exception 'REVISION_CONFLICT';end if;
 perform private.tower_refresh_rewards(uid);
 select * into a from private.tower_accounts where user_id=uid;
 items:=a.elements;
 if p_action='place' then
 if jsonb_typeof(p_element)<>'object' or (p_currency is null or p_currency not in ('silver','gold')) then raise exception 'INVALID_ELEMENT';end if;
 eid:=(p_element->>'id')::uuid;typ:=p_element->>'type';dx:=(p_element->>'sx')::int;dy:=(p_element->>'sy')::int;dz:=(p_element->>'sz')::int;rot:=(p_element->>'rotation')::int;
 if eid is null or rot is null or rot not in (0,1,2,3,4,5) or dx is null or dy is null or dz is null then raise exception 'INVALID_ELEMENT';end if;
 canonical_x:=dx;canonical_z:=dz;
 valid:=case typ
 when 'stone' then dx=1 and dy=1 and dz=1
 when 'medium' then canonical_x=2 and canonical_z between 1 and 2 and dy=1
 when 'long' then canonical_x between 3 and 5 and canonical_z between 1 and 2 and dy=1
 when 'big' then dx between 3 and 5 and dz between 3 and 5 and dy between 2 and 4
 when 'beam' then canonical_x between 8 and 16 and dy=1 and canonical_z=1
 when 'deck' then canonical_x=4 and canonical_z between 1 and 4 and dy=1
 when 'window' then canonical_x between 2 and 4 and dy between 4 and 5 and canonical_z=1
 when 'door' then canonical_x between 2 and 4 and dy between 6 and 8 and canonical_z=1
 when 'ladder' then canonical_x=3 and canonical_z between 1 and 4 and dy between 8 and 16
 when 'roof' then dx between 4 and 40 and dz between 4 and 40 and dy between 2 and 8
 else false end;
 if rot>3 and typ<>'beam' then raise exception 'INVALID_ROTATION';end if;
 if not coalesce(valid,false) then raise exception 'INVALID_DIMENSIONS';end if;
 cost:=case typ when 'stone' then 1 when 'medium' then 4 when 'long' then 8 when 'big' then 24 when 'beam' then 8 when 'deck' then 16 when 'window' then 24 when 'door' then 32 when 'ladder' then 64 when 'roof' then 160 end;
 if p_currency='gold' and cost%8<>0 then raise exception 'USE_SILVER';end if;
 paid:=case when p_currency='gold' then cost/8 else cost end;
 if (p_currency='silver' and a.silver<paid) or (p_currency='gold' and a.gold<paid) then raise exception 'INSUFFICIENT_FUNDS';end if;
 if exists(select 1 from jsonb_array_elements(items) q where q->>0=eid::text) then raise exception 'ELEMENT_ID_EXISTS';end if;
 if jsonb_array_length(items)>=10000 then raise exception 'ELEMENT_LIMIT';end if;
 e:=jsonb_build_array(eid,typ,(p_element->>'x')::int,(p_element->>'y')::int,(p_element->>'z')::int,dx,dy,dz,rot,coalesce((p_element->>'variant')::int,0),p_currency,paid);
 if e->>2 is null or e->>3 is null or e->>4 is null or (e->>9)::int not between 0 and 255 then raise exception 'INVALID_ELEMENT';end if;
 if not private.tower_place_valid(items,e) then raise exception 'INVALID_PLACEMENT_OR_SUPPORT';end if;
 items:=items||jsonb_build_array(e);
 if p_currency='silver' then a.silver:=a.silver-paid;else a.gold:=a.gold-paid;end if;
 elsif p_action='remove' then
 select value into e from jsonb_array_elements(items) where value->>0=p_element_id::text;
 if e is null then raise exception 'ELEMENT_NOT_FOUND';end if;
 select coalesce(jsonb_agg(value),'[]') into items from jsonb_array_elements(items) where value->>0<>p_element_id::text;
 if not private.tower_remove_valid(items,e) then raise exception 'DEPENDENT_ELEMENTS_REQUIRE_REMOVAL';end if;
 if e->>10='silver' then a.silver:=a.silver+(e->>11)::int;else a.gold:=a.gold+(e->>11)::int;end if;
 elsif p_action='exchange_gold' then
 if a.gold<1 then raise exception 'INSUFFICIENT_FUNDS';end if;a.gold:=a.gold-1;a.silver:=a.silver+8;
 elsif p_action='exchange_silver' then
 if a.silver<8 then raise exception 'INSUFFICIENT_FUNDS';end if;a.silver:=a.silver-8;a.gold:=a.gold+1;
 else raise exception 'INVALID_ACTION';end if;
 update private.tower_accounts set revision=revision+1,silver=a.silver,gold=a.gold,elements=items,updated_at=now() where user_id=uid returning jsonb_build_object('revision',revision,'silver',silver,'gold',gold,'elements',elements,'reward_mapping_version',1) into result;
 insert into private.tower_receipts(user_id,operation_id,request,response) values(uid,p_operation_id,req,result-'elements');
 return result;
end $$;

revoke all on function private.tower_world_element(jsonb),private.tower_element_supported(jsonb,jsonb),private.tower_place_valid(jsonb,jsonb),private.tower_remove_valid(jsonb,jsonb) from public,anon,authenticated;

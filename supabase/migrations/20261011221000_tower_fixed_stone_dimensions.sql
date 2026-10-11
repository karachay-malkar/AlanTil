-- AlanTil Tower 17.0: fixed, catalog-defined dimensions (X length, Y height, Z depth).
-- Existing saved rocks are not rewritten or revalidated; only future 'place' operations
-- use these limits. All currency/revision/retry/refund logic is preserved verbatim.
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
 when 'medium' then dx=2 and dy between 1 and 2 and dz=1
 when 'long' then dx between 3 and 5 and dy between 1 and 2 and dz=1
 when 'big' then dx between 3 and 5 and dy between 2 and 4 and dz between 2 and 4
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
 if p_currency='gold' and (cost%8<>0 or typ in ('stone','medium','long')) then raise exception 'USE_SILVER';end if;
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


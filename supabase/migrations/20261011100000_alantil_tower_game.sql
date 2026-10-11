-- Tower v1: compact snapshots, owner-bound atomic economy, saved-test rewards.
create table private.tower_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 revision bigint not null default 0, silver bigint not null default 0 check(silver>=0),
 gold bigint not null default 0 check(gold>=0), elements jsonb not null default '[]',
 updated_at timestamptz not null default now(), check(jsonb_typeof(elements)='array')
);
create table private.tower_word_rewards (
 user_id uuid not null references auth.users(id) on delete cascade, word_id text not null,
 currency text not null check(currency in ('silver','gold')), created_at timestamptz not null default now(),
 primary key(user_id,word_id)
);
create table private.tower_receipts (
 user_id uuid not null references auth.users(id) on delete cascade, operation_id uuid not null,
 request jsonb not null, response jsonb not null, created_at timestamptz not null default now(),
 primary key(user_id,operation_id)
);
alter table private.tower_accounts enable row level security;
alter table private.tower_word_rewards enable row level security;
alter table private.tower_receipts enable row level security;
revoke all on private.tower_accounts,private.tower_word_rewards,private.tower_receipts from public,anon,authenticated;

create function private.tower_refresh_rewards(uid uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 with qualified as (
 select w.word_id from public.test_session_words w join public.test_sessions s on s.id=w.session_id and s.user_id=w.user_id where w.user_id=uid and w.result='correct' and s.status='completed'
 union
 select w.word_id from public.station_test_session_words w join public.station_test_sessions s on s.id=w.session_id and s.user_id=w.user_id where w.user_id=uid and w.result='correct' and s.status='completed'
 ), minted as (
 insert into private.tower_word_rewards(user_id,word_id,currency)
 select uid,q.word_id,case when c.dictionary_id in ('intermediate','advanced') then 'gold' else 'silver' end
 from qualified q join public.content_words c on c.word_id=q.word_id
 on conflict do nothing returning currency
 ) update private.tower_accounts set silver=silver+(select count(*) from minted where currency='silver'),gold=gold+(select count(*) from minted where currency='gold') where user_id=uid;
end $$;

-- Element array: id,type,x,y,z,sx,sy,sz,rotation,variant,currency,paid.
create function private.tower_geometry_valid(items jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare a jsonb; b jsonb; x int; y int; z int; sx int; sy int; sz int; supported boolean; left_ok boolean; right_ok boolean; cx int; cz int; cell_ok boolean;
begin
 select coalesce(jsonb_agg(jsonb_set(jsonb_set(jsonb_set(value,'{5}',case when (value->>8)::int=4 then value->6 when (value->>8)::int%2=1 and (value->>8)::int<4 then value->7 else value->5 end),'{6}',case when (value->>8)::int=4 then value->5 when (value->>8)::int=5 then value->7 else value->6 end),'{7}',case when (value->>8)::int=5 then value->6 when (value->>8)::int%2=1 and (value->>8)::int<4 then value->5 else value->7 end)),'[]') into items from jsonb_array_elements(items);
 for a in select value from jsonb_array_elements(items) loop
 x:=(a->>2)::int;y:=(a->>3)::int;z:=(a->>4)::int;sx:=(a->>5)::int;sy:=(a->>6)::int;sz:=(a->>7)::int;
 if x<0 or y<0 or z<0 or sx<1 or sy<1 or sz<1 or x+sx>60 or z+sz>60 or y+sy>80 then return false;end if;
 supported:=y=0;left_ok:=false;right_ok:=false;
 for b in select value from jsonb_array_elements(items) loop
 if a->>0=b->>0 then continue;end if;
 if x<(b->>2)::int+(b->>5)::int and x+sx>(b->>2)::int and y<(b->>3)::int+(b->>6)::int and y+sy>(b->>3)::int and z<(b->>4)::int+(b->>7)::int and z+sz>(b->>4)::int then return false;end if;
 if (b->>3)::int+(b->>6)::int=y and b->>1 not in ('window','door','ladder','roof') then
 if x<(b->>2)::int+(b->>5)::int and x+sx>(b->>2)::int and z<(b->>4)::int+(b->>7)::int and z+sz>(b->>4)::int then supported:=true;end if;
 if sx>=sz then
 left_ok:=left_ok or (x>=(b->>2)::int and x<(b->>2)::int+(b->>5)::int and z<(b->>4)::int+(b->>7)::int and z+sz>(b->>4)::int);
 right_ok:=right_ok or (x+sx-1>=(b->>2)::int and x+sx-1<(b->>2)::int+(b->>5)::int and z<(b->>4)::int+(b->>7)::int and z+sz>(b->>4)::int);
 else
 left_ok:=left_ok or (z>=(b->>4)::int and z<(b->>4)::int+(b->>7)::int and x<(b->>2)::int+(b->>5)::int and x+sx>(b->>2)::int);
 right_ok:=right_ok or (z+sz-1>=(b->>4)::int and z+sz-1<(b->>4)::int+(b->>7)::int and x<(b->>2)::int+(b->>5)::int and x+sx>(b->>2)::int);
 end if;
 end if;
 end loop;
 if not supported then return false;end if;
 if y>0 and a->>1 not in ('long','beam','deck','roof') then
 for cx in x..x+sx-1 loop for cz in z..z+sz-1 loop
 select exists(select 1 from jsonb_array_elements(items) q where q->>0<>a->>0 and q->>1 not in ('window','door','ladder','roof') and (q->>3)::int+(q->>6)::int=y and cx>=(q->>2)::int and cx<(q->>2)::int+(q->>5)::int and cz>=(q->>4)::int and cz<(q->>4)::int+(q->>7)::int) into cell_ok;
 if not cell_ok then return false;end if;
 end loop;end loop;
 end if;
 if y>0 and a->>1 in ('long','beam','deck','roof') then
 for cx in x..x+sx-1 loop for cz in z..z+sz-1 loop
 if (sx>=sz and cx in (x,x+sx-1)) or (sx<sz and cz in (z,z+sz-1)) then
 select exists(select 1 from jsonb_array_elements(items) q where q->>0<>a->>0 and q->>1 not in ('window','door','ladder','roof') and (q->>3)::int+(q->>6)::int=y and cx>=(q->>2)::int and cx<(q->>2)::int+(q->>5)::int and cz>=(q->>4)::int and cz<(q->>4)::int+(q->>7)::int) into cell_ok;
 if not cell_ok then return false;end if;
 end if;end loop;end loop;
 end if;
 end loop;return true;
end $$;

create function private.get_tower_snapshot(p_user_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); target uuid:=coalesce(p_user_id,auth.uid()); a private.tower_accounts;
begin
 if uid is null then raise exception 'AUTH_REQUIRED';end if;
 if target=uid then
 insert into private.tower_accounts(user_id) values(uid) on conflict do nothing;
 perform 1 from private.tower_accounts where user_id=uid for update;
 perform private.tower_refresh_rewards(uid);
 end if;
 select * into a from private.tower_accounts where user_id=target;
 return jsonb_build_object('revision',coalesce(a.revision,0),'silver',case when target=uid then coalesce(a.silver,0) else null end,'gold',case when target=uid then coalesce(a.gold,0) else null end,'elements',coalesce(a.elements,'[]'::jsonb),'reward_mapping_version',1);
end $$;

create function private.mutate_tower(p_revision bigint,p_operation_id uuid,p_action text,p_element jsonb default null,p_element_id uuid default null,p_currency text default 'silver') returns jsonb language plpgsql security definer set search_path='' as $$
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
 items:=items||jsonb_build_array(e);
 if not private.tower_geometry_valid(items) then raise exception 'INVALID_PLACEMENT_OR_SUPPORT';end if;
 if p_currency='silver' then a.silver:=a.silver-paid;else a.gold:=a.gold-paid;end if;
 elsif p_action='remove' then
 select value into e from jsonb_array_elements(items) where value->>0=p_element_id::text;
 if e is null then raise exception 'ELEMENT_NOT_FOUND';end if;
 select coalesce(jsonb_agg(value),'[]') into items from jsonb_array_elements(items) where value->>0<>p_element_id::text;
 if not private.tower_geometry_valid(items) then raise exception 'DEPENDENT_ELEMENTS_REQUIRE_REMOVAL';end if;
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

create function public.get_tower_snapshot(p_user_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.get_tower_snapshot(p_user_id)$$;
create function public.mutate_tower(p_revision bigint,p_operation_id uuid,p_action text,p_element jsonb default null,p_element_id uuid default null,p_currency text default 'silver') returns jsonb language sql security invoker set search_path='' as $$select private.mutate_tower(p_revision,p_operation_id,p_action,p_element,p_element_id,p_currency)$$;
revoke all on function private.tower_refresh_rewards(uuid),private.tower_geometry_valid(jsonb),private.get_tower_snapshot(uuid),private.mutate_tower(bigint,uuid,text,jsonb,uuid,text),public.get_tower_snapshot(uuid),public.mutate_tower(bigint,uuid,text,jsonb,uuid,text) from public,anon;
grant execute on function private.get_tower_snapshot(uuid),private.mutate_tower(bigint,uuid,text,jsonb,uuid,text),public.get_tower_snapshot(uuid),public.mutate_tower(bigint,uuid,text,jsonb,uuid,text) to authenticated;

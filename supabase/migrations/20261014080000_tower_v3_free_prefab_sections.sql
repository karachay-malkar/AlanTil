-- AlanTil 17.5.1: free, permanent, server-authoritative prefabricated masonry.
-- Legacy paid V1/V2 tables, balances, RPCs and receipts remain untouched.
create table if not exists private.tower_v3_state (
 user_id uuid primary key references auth.users(id) on delete cascade,
 revision bigint not null default 0 check(revision>=0),
 updated_at timestamptz not null default now()
);
create table if not exists private.tower_v3_sections (
 user_id uuid not null references auth.users(id) on delete cascade,
 id uuid not null,
 section_id text not null check(section_id in ('1x1x1','2x2x2','2x2x3','2x3x4','4x4x4')),
 variant_id smallint not null check(variant_id between 0 and 7),
 geometry_version text not null check(geometry_version in ('17.5.0','17.5.1')),
 grid_x integer not null,grid_y integer not null,grid_z integer not null,
 rotation smallint not null check(rotation between 0 and 3),
 created_at timestamptz not null default now(),
 primary key(user_id,id)
);
create index if not exists tower_v3_sections_owner_order on private.tower_v3_sections(user_id,created_at,id);
create table if not exists private.tower_v3_receipts (
 user_id uuid not null references auth.users(id) on delete cascade,
 operation_id uuid not null,request jsonb not null,response jsonb not null,
 created_at timestamptz not null default now(),
 primary key(user_id,operation_id)
);
alter table private.tower_v3_state enable row level security;
alter table private.tower_v3_sections enable row level security;
alter table private.tower_v3_receipts enable row level security;
revoke all on private.tower_v3_state,private.tower_v3_sections,private.tower_v3_receipts from public,anon,authenticated;

create or replace function private.tower_v3_size(p_type text,p_rotation integer)
returns integer[] language sql immutable set search_path='' as $$
 select case p_type
  when '1x1x1' then array[1,1,1]
  when '2x2x2' then array[2,2,2]
  when '2x2x3' then case when p_rotation%2=1 then array[3,2,2] else array[2,2,3] end
  when '2x3x4' then case when p_rotation%2=1 then array[4,3,2] else array[2,3,4] end
  when '4x4x4' then array[4,4,4]
  else null::integer[] end
$$;

create or replace function private.tower_v3_canonical(e jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare typ text;v int;r int;px int;py int;pz int;dims int[];uid uuid;
begin
 if e is null or jsonb_typeof(e)<>'object' then raise exception 'INVALID_V3_SECTION';end if;
 if (e->>'id') is null or (e->>'sectionId') is null or (e->>'geometryVersion') is null or
    (e->>'variant') is null or (e->>'rotation') is null or (e->>'x') is null or (e->>'y') is null or (e->>'z') is null then
  raise exception 'INVALID_V3_SECTION';end if;
 if (e->>'variant') !~ '^[0-9]+$' or (e->>'rotation') !~ '^[0-9]+$' or
    (e->>'x') !~ '^[0-9]+$' or (e->>'y') !~ '^[0-9]+$' or (e->>'z') !~ '^[0-9]+$' then raise exception 'GRID_REQUIRED';end if;
 uid:=(e->>'id')::uuid;typ:=e->>'sectionId';v:=(e->>'variant')::int;r:=(e->>'rotation')::int;
 px:=(e->>'x')::int;py:=(e->>'y')::int;pz:=(e->>'z')::int;
 dims:=private.tower_v3_size(typ,r);
 if uid is null or dims is null or v not between 0 and 7 or r not between 0 and 3 or
   e->>'geometryVersion' not in ('17.5.0','17.5.1') or px+ dims[1]>60 or py+dims[2]>80 or pz+dims[3]>60 then
  raise exception 'INVALID_V3_SECTION';end if;
 return jsonb_build_object('id',uid,'type','masonry_section','sectionId',typ,'variant',v,
   'rotation',r,'x',px,'y',py,'z',pz,'geometryVersion',e->>'geometryVersion');
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'INVALID_V3_SECTION';
end $$;

create or replace function private.tower_v3_snapshot_rows(p_uid uuid)
returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'type','masonry_section','sectionId',section_id,
  'variant',variant_id,'rotation',rotation,'x',grid_x,'y',grid_y,'z',grid_z,
  'geometryVersion',geometry_version) order by created_at,id),'[]'::jsonb)
 from private.tower_v3_sections where user_id=p_uid
$$;

-- Legacy paid envelopes participate in server collision/support decisions.
-- Their data are read only, and purchases are not converted to V3.
create or replace function private.tower_v3_legacy_envelopes(p_uid uuid)
returns jsonb language plpgsql stable set search_path='' as $$
declare result jsonb:='[]'::jsonb;rowv jsonb;t int;r int;sx numeric;sy numeric;sz numeric;dx numeric;dy numeric;dz numeric;
begin
 for rowv in select value from private.tower_accounts a cross join lateral jsonb_array_elements(a.elements) v where a.user_id=p_uid loop
  begin
   if jsonb_typeof(rowv)<>'array' or jsonb_array_length(rowv)<9 then continue;end if;
   sx:=(rowv->>5)::numeric;sy:=(rowv->>6)::numeric;sz:=(rowv->>7)::numeric;r:=(rowv->>8)::int;t:=(rowv->>1)::int;
   dx:=sx;dy:=sy;dz:=sz;
   if r in (1,3,7) then dx:=sz;dz:=sx;end if;
   if r=4 then dx:=sy;dy:=sx;end if;
   if r=5 then dy:=sz;dz:=sy;end if;
   if r=6 then dx:=sy;dy:=sz;dz:=sx;end if;
   if r=7 then dy:=sx;dz:=sy;end if;
   if sx<=0 or sy<=0 or sz<=0 then continue;end if;
   result:=result||jsonb_build_array(jsonb_build_object('x',(rowv->>2)::numeric,'y',(rowv->>3)::numeric,
     'z',(rowv->>4)::numeric,'sx',dx,'sy',dy,'sz',dz,'support',t not in (6,7,8,9)));
  exception when others then null;end;
 end loop;
 for rowv in select data from private.tower_v2_elements where user_id=p_uid loop
  begin
   sx:=(rowv->>'sx')::numeric;sy:=(rowv->>'sy')::numeric;sz:=(rowv->>'sz')::numeric;r:=(rowv->>'rotation')::int;
   dx:=sx;dy:=sy;dz:=sz;
   if r in (1,3,7) then dx:=sz;dz:=sx;end if;
   if r=4 then dx:=sy;dy:=sx;end if;
   if r=5 then dy:=sz;dz:=sy;end if;
   if r=6 then dx:=sy;dy:=sz;dz:=sx;end if;
   if r=7 then dx:=sz;dy:=sx;dz:=sy;end if;
   if sx<=0 or sy<=0 or sz<=0 then continue;end if;
   result:=result||jsonb_build_array(jsonb_build_object('x',(rowv->>'x')::numeric,'y',(rowv->>'y')::numeric,
     'z',(rowv->>'z')::numeric,'sx',dx,'sy',dy,'sz',dz,'support',true));
  exception when others then null;end;
 end loop;
 return result;
end $$;

-- One authoritative validation procedure, shared by placement and removal.
-- A 25-cm grid cell has either full support or none. No partial bridging.
create or replace function private.tower_v3_valid_layout(p_uid uuid,p_sections jsonb)
returns boolean language plpgsql stable set search_path='' as $$
declare e jsonb;others jsonb:='[]'::jsonb;all_boxes jsonb;box jsonb;other jsonb;dims int[];
 px numeric;py numeric;pz numeric;sx numeric;sy numeric;sz numeric;
 x int;y int;z int;supported boolean;seen_ids uuid[]:=array[]::uuid[];
begin
 if p_sections is null or jsonb_typeof(p_sections)<>'array' or jsonb_array_length(p_sections)>250 then return false;end if;
 for e in select value from jsonb_array_elements(p_sections) loop
  begin e:=private.tower_v3_canonical(e);exception when others then return false;end;
  if (e->>'id')::uuid=any(seen_ids) then return false;end if;
  seen_ids:=array_append(seen_ids,(e->>'id')::uuid);
  dims:=private.tower_v3_size(e->>'sectionId',(e->>'rotation')::int);
  others:=others||jsonb_build_array(jsonb_build_object('id',e->>'id','x',e->'x','y',e->'y','z',e->'z',
     'sx',dims[1],'sy',dims[2],'sz',dims[3],'support',true));
 end loop;
 all_boxes:=others||private.tower_v3_legacy_envelopes(p_uid);
 for box in select value from jsonb_array_elements(others) loop
  px:=(box->>'x')::numeric;py:=(box->>'y')::numeric;pz:=(box->>'z')::numeric;
  sx:=(box->>'sx')::numeric;sy:=(box->>'sy')::numeric;sz:=(box->>'sz')::numeric;
  for other in select value from jsonb_array_elements(all_boxes) loop
   if other->>'id'=box->>'id' and other ? 'id' then continue;end if;
   if px<(other->>'x')::numeric+(other->>'sx')::numeric and px+sx>(other->>'x')::numeric and
      py<(other->>'y')::numeric+(other->>'sy')::numeric and py+sy>(other->>'y')::numeric and
      pz<(other->>'z')::numeric+(other->>'sz')::numeric and pz+sz>(other->>'z')::numeric then return false;end if;
  end loop;
  if py=0 then continue;end if;
  for x in px::int..(px+sx)::int-1 loop for z in pz::int..(pz+sz)::int-1 loop
   supported:=false;
   for other in select value from jsonb_array_elements(all_boxes) loop
    if not coalesce((other->>'support')::boolean,false) then continue;end if;
    if abs((other->>'y')::numeric+(other->>'sy')::numeric-py)<.00001 and
       x+.5>=(other->>'x')::numeric and x+.5<=(other->>'x')::numeric+(other->>'sx')::numeric and
       z+.5>=(other->>'z')::numeric and z+.5<=(other->>'z')::numeric+(other->>'sz')::numeric then supported:=true;exit;end if;
   end loop;
   if not supported then return false;end if;
  end loop;end loop;
 end loop;
 return true;
end $$;

create or replace function private.get_tower_v3_snapshot(p_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();target uuid:=coalesce(p_user_id,auth.uid()); rev bigint;
begin
 if uid is null then raise exception 'AUTH_REQUIRED';end if;
 if target=uid then insert into private.tower_v3_state(user_id) values(uid) on conflict do nothing;end if;
 select revision into rev from private.tower_v3_state where user_id=target;
 return jsonb_build_object('format',3,'revision',coalesce(rev,0),'elements',private.tower_v3_snapshot_rows(target));
end $$;

create or replace function private.mutate_tower_v3(p_revision bigint,p_operation_id uuid,p_action text,p_section jsonb default null,p_section_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();state private.tower_v3_state; receipt private.tower_v3_receipts;
 req jsonb;current_sections jsonb;candidate jsonb;new_sections jsonb;result jsonb;eid uuid;
begin
 if uid is null then raise exception 'AUTH_REQUIRED';end if;
 if p_revision is null or p_revision<0 or p_operation_id is null or p_action not in ('place','remove') then raise exception 'INVALID_V3_REQUEST';end if;
 req:=jsonb_build_array('tower_v3',p_revision,p_action,p_section,p_section_id);
 insert into private.tower_v3_state(user_id) values(uid) on conflict do nothing;
 perform 1 from private.tower_accounts where user_id=uid for update;
 select * into state from private.tower_v3_state where user_id=uid for update;
 select * into receipt from private.tower_v3_receipts where user_id=uid and operation_id=p_operation_id;
 if found then
  if receipt.request<>req then raise exception 'OPERATION_ID_REUSED';end if;
  return receipt.response||jsonb_build_object('replayed',true);
 end if;
 if state.revision<>p_revision then raise exception 'REVISION_CONFLICT';end if;
 current_sections:=private.tower_v3_snapshot_rows(uid);
 if p_action='place' then
  if p_section_id is not null then raise exception 'INVALID_V3_REQUEST';end if;
  candidate:=private.tower_v3_canonical(p_section);eid:=(candidate->>'id')::uuid;
  if exists(select 1 from private.tower_v3_sections where user_id=uid and id=eid) then raise exception 'DUPLICATE_SECTION';end if;
  new_sections:=current_sections||jsonb_build_array(candidate);
  if not private.tower_v3_valid_layout(uid,new_sections) then raise exception 'INVALID_V3_PLACEMENT';end if;
  insert into private.tower_v3_sections(user_id,id,section_id,variant_id,geometry_version,grid_x,grid_y,grid_z,rotation)
   values(uid,eid,candidate->>'sectionId',(candidate->>'variant')::smallint,candidate->>'geometryVersion',
   (candidate->>'x')::integer,(candidate->>'y')::integer,(candidate->>'z')::integer,(candidate->>'rotation')::smallint);
 elsif p_action='remove' then
  if p_section is not null or p_section_id is null then raise exception 'INVALID_V3_REQUEST';end if;
  if not exists(select 1 from private.tower_v3_sections where user_id=uid and id=p_section_id) then raise exception 'UNKNOWN_V3_SECTION';end if;
  select coalesce(jsonb_agg(value),'[]'::jsonb) into new_sections from jsonb_array_elements(current_sections) x where x.value->>'id'<>p_section_id::text;
  if not private.tower_v3_valid_layout(uid,new_sections) then raise exception 'SUPPORT_REQUIRED';end if;
  delete from private.tower_v3_sections where user_id=uid and id=p_section_id;
 end if;
 update private.tower_v3_state set revision=revision+1,updated_at=now() where user_id=uid;
 result:=jsonb_build_object('format',3,'revision',state.revision+1,'elements',private.tower_v3_snapshot_rows(uid));
 insert into private.tower_v3_receipts(user_id,operation_id,request,response) values(uid,p_operation_id,req,result);
 return result;
end $$;

create or replace function public.get_tower_v3_snapshot(p_user_id uuid default null)
returns jsonb language sql security invoker set search_path='' as $$ select private.get_tower_v3_snapshot(p_user_id) $$;
create or replace function public.mutate_tower_v3(p_revision bigint,p_operation_id uuid,p_action text,p_section jsonb default null,p_section_id uuid default null)
returns jsonb language sql security invoker set search_path='' as $$ select private.mutate_tower_v3(p_revision,p_operation_id,p_action,p_section,p_section_id) $$;

revoke all on function private.tower_v3_size(text,integer),private.tower_v3_canonical(jsonb),private.tower_v3_snapshot_rows(uuid),
 private.tower_v3_legacy_envelopes(uuid),private.tower_v3_valid_layout(uuid,jsonb) from public,anon,authenticated;
revoke all on function private.get_tower_v3_snapshot(uuid),private.mutate_tower_v3(bigint,uuid,text,jsonb,uuid),
 public.get_tower_v3_snapshot(uuid),public.mutate_tower_v3(bigint,uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function private.get_tower_v3_snapshot(uuid),private.mutate_tower_v3(bigint,uuid,text,jsonb,uuid),
 public.get_tower_v3_snapshot(uuid),public.mutate_tower_v3(bigint,uuid,text,jsonb,uuid) to authenticated;

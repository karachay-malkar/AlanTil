-- AlanTil 17.1 / tower V2. The original tower_accounts.elements and all V1
-- functions stay intact. V2 stores a different tower, sharing wallet/revision.
-- The server does NOT trust clients to report supported or collision-free poses.
create table if not exists private.tower_v2_shapes (
 type text not null check(type in ('stone','medium','long','big')),
 variant integer not null check(variant>=0 and variant<23),
 geometry jsonb not null check(jsonb_typeof(geometry)='object'),
 primary key(type,variant)
);
create table if not exists private.tower_v2_elements (
 user_id uuid not null references auth.users(id) on delete cascade,
 id uuid not null,
 data jsonb not null check(jsonb_typeof(data)='object'),
 created_at timestamptz not null default now(),
 primary key(user_id,id)
);
create index if not exists tower_v2_elements_by_owner on private.tower_v2_elements(user_id,created_at,id);
alter table private.tower_v2_shapes enable row level security;
alter table private.tower_v2_elements enable row level security;
revoke all on private.tower_v2_shapes,private.tower_v2_elements from public,anon,authenticated;

-- Shape normalization is identical to the existing Three.js scene: source
-- vertex -> per-axis local dimension -> orientation 0..7 -> bounding-cell
-- centre in METERS. The 25cm cell is a unit of measure, not a snap operation.
create or replace function private.tower_v2_dims(e jsonb)
returns double precision[] language plpgsql immutable set search_path='' as $$
declare x double precision:=(e->>'sx')::double precision; y double precision:=(e->>'sy')::double precision; z double precision:=(e->>'sz')::double precision; r int:=(e->>'rotation')::int;
begin
 return case when r in (1,3) then array[z,y,x] when r=4 then array[y,x,z]
  when r=5 then array[x,z,y] when r=6 then array[y,z,x] when r=7 then array[z,x,y]
  else array[x,y,z] end;
end $$;

create or replace function private.tower_v2_body(e jsonb)
returns jsonb language plpgsql stable set search_path='' as $$
declare shape jsonb; src jsonb; v jsonb; vertices jsonb:='[]'::jsonb; faces jsonb; normals jsonb:='[]'::jsonb; edges jsonb:='[]'::jsonb;
 raw double precision[]; o double precision[]; dims double precision[]:=private.tower_v2_dims(e);
 cx double precision;cy double precision;cz double precision; sx double precision:=(e->>'sx')::double precision*.25;sy double precision:=(e->>'sy')::double precision*.25;sz double precision:=(e->>'sz')::double precision*.25;
 x double precision;y double precision;z double precision; a double precision[];b double precision[];c double precision[];n double precision[]; ix int;iy int;iz int;r int:=(e->>'rotation')::int;
 xx double precision:=0;yy double precision:=0;zz double precision:=0;count int:=0;
 lo_x double precision:='Infinity';lo_y double precision:='Infinity';lo_z double precision:='Infinity';hi_x double precision:='-Infinity';hi_y double precision:='-Infinity';hi_z double precision:='-Infinity';i int;j int;
begin
 select geometry into shape from private.tower_v2_shapes where type=e->>'type' and variant=(e->>'variant')::int;
 if shape is null then raise exception 'UNKNOWN_AUTHORED_SHAPE';end if;
 cx:=((e->>'x')::double precision+dims[1]/2)*.25;
 cy:=((e->>'y')::double precision+dims[2]/2)*.25;
 cz:=((e->>'z')::double precision+dims[3]/2)*.25;
 faces:=shape->'f';
 for src in select value from jsonb_array_elements(shape->'v') loop
  x:=(src->>0)::double precision*sx;y:=(src->>1)::double precision*sy;z:=(src->>2)::double precision*sz;
  o:=case r when 0 then array[x,y,z] when 1 then array[z,y,-x] when 2 then array[-x,y,-z] when 3 then array[-z,y,x]
   when 4 then array[y,-x,z] when 5 then array[x,-z,y] when 6 then array[y,z,x] else array[z,x,y] end;
  raw:=array[o[1]+cx,o[2]+cy,o[3]+cz];
  vertices:=vertices||jsonb_build_array(to_jsonb(raw));xx:=xx+raw[1];yy:=yy+raw[2];zz:=zz+raw[3];count:=count+1;
  lo_x:=least(lo_x,raw[1]);lo_y:=least(lo_y,raw[2]);lo_z:=least(lo_z,raw[3]);
  hi_x:=greatest(hi_x,raw[1]);hi_y:=greatest(hi_y,raw[2]);hi_z:=greatest(hi_z,raw[3]);
 end loop;
 if count<4 then raise exception 'INVALID_AUTHORED_SHAPE';end if;
 for src in select value from jsonb_array_elements(faces) loop
  a:=array[(vertices->((src->>0)::int)->>0)::double precision,(vertices->((src->>0)::int)->>1)::double precision,(vertices->((src->>0)::int)->>2)::double precision];
  b:=array[(vertices->((src->>1)::int)->>0)::double precision,(vertices->((src->>1)::int)->>1)::double precision,(vertices->((src->>1)::int)->>2)::double precision];
  c:=array[(vertices->((src->>2)::int)->>0)::double precision,(vertices->((src->>2)::int)->>1)::double precision,(vertices->((src->>2)::int)->>2)::double precision];
  n:=array[(b[2]-a[2])*(c[3]-a[3])-(b[3]-a[3])*(c[2]-a[2]),
           (b[3]-a[3])*(c[1]-a[1])-(b[1]-a[1])*(c[3]-a[3]),
           (b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1])];
  normals:=normals||jsonb_build_array(to_jsonb(n));
  edges:=edges||jsonb_build_array(jsonb_build_array(b[1]-a[1],b[2]-a[2],b[3]-a[3]),jsonb_build_array(c[1]-b[1],c[2]-b[2],c[3]-b[3]),jsonb_build_array(a[1]-c[1],a[2]-c[2],a[3]-c[3]));
 end loop;
 return jsonb_build_object('v',vertices,'f',faces,'n',normals,'e',edges,
  'lo',jsonb_build_array(lo_x,lo_y,lo_z),'hi',jsonb_build_array(hi_x,hi_y,hi_z),
  'center',jsonb_build_array(xx/count,yy/count,zz/count));
end $$;

-- A found separating direction certifies that two convex hulls cannot overlap;
-- failing to find one rejects the pose (safe false negatives are possible).
create or replace function private.tower_v2_separating_axis(a jsonb,b jsonb,axis jsonb)
returns boolean language plpgsql immutable set search_path='' as $$
declare dx double precision:=(axis->>0)::double precision;dy double precision:=(axis->>1)::double precision;dz double precision:=(axis->>2)::double precision;
 len double precision:=sqrt(dx*dx+dy*dy+dz*dz);lo_a double precision:='Infinity';hi_a double precision:='-Infinity';lo_b double precision:='Infinity';hi_b double precision:='-Infinity'; v jsonb;d double precision;
begin
 if len<1e-8 then return false;end if;
 for v in select value from jsonb_array_elements(a->'v') loop
  d:=(v->>0)::double precision*dx+(v->>1)::double precision*dy+(v->>2)::double precision*dz;
  lo_a:=least(lo_a,d);hi_a:=greatest(hi_a,d);
 end loop;
 for v in select value from jsonb_array_elements(b->'v') loop
  d:=(v->>0)::double precision*dx+(v->>1)::double precision*dy+(v->>2)::double precision*dz;
  lo_b:=least(lo_b,d);hi_b:=greatest(hi_b,d);
 end loop;
 return least(hi_a,hi_b)-greatest(lo_a,lo_b)<=.00035*len;
end $$;

create or replace function private.tower_v2_collides(a jsonb,b jsonb)
returns boolean language plpgsql immutable set search_path='' as $$
declare na jsonb;nb jsonb;edge_a jsonb;edge_b jsonb; ax double precision;ay double precision;az double precision;bx double precision;byv double precision;bz double precision;
begin
 -- AABB only for fast rejection, never for acceptance of a position.
 if (a->'hi'->>0)::double precision <= (b->'lo'->>0)::double precision+.00035 or
 (b->'hi'->>0)::double precision <= (a->'lo'->>0)::double precision+.00035 or
 (a->'hi'->>1)::double precision <= (b->'lo'->>1)::double precision+.00035 or
 (b->'hi'->>1)::double precision <= (a->'lo'->>1)::double precision+.00035 or
 (a->'hi'->>2)::double precision <= (b->'lo'->>2)::double precision+.00035 or
 (b->'hi'->>2)::double precision <= (a->'lo'->>2)::double precision+.00035 then return false;end if;
 for na in select value from jsonb_array_elements(a->'n') loop
  if private.tower_v2_separating_axis(a,b,na) then return false;end if;
 end loop;
 for nb in select value from jsonb_array_elements(b->'n') loop
  if private.tower_v2_separating_axis(a,b,nb) then return false;end if;
 end loop;
 -- Cross products of all source edges cover edge/edge SAT directions.
 for edge_a in select value from jsonb_array_elements(a->'e') loop
  ax:=(edge_a->>0)::double precision;ay:=(edge_a->>1)::double precision;az:=(edge_a->>2)::double precision;
  for edge_b in select value from jsonb_array_elements(b->'e') loop
   bx:=(edge_b->>0)::double precision;byv:=(edge_b->>1)::double precision;bz:=(edge_b->>2)::double precision;
   if private.tower_v2_separating_axis(a,b,jsonb_build_array(ay*bz-az*byv,az*bx-ax*bz,ax*byv-ay*bx)) then return false;end if;
  end loop;
 end loop;
 return true;
end $$;

-- The real authored triangles are queried for vertical contact. The input
-- meshes are open, so winding/parity cannot be used as a reliable solid test.
create or replace function private.tower_v2_surface_y(body jsonb,px double precision,pz double precision,upper boolean)
returns double precision language plpgsql immutable set search_path='' as $$
declare f jsonb;v jsonb:=body->'v';a jsonb;b jsonb;c jsonb;
 ax double precision;az double precision;bx double precision;bz double precision;cx double precision;cz double precision;
 denom double precision;u double precision;w double precision;y double precision;result double precision:=null;
begin
 for f in select value from jsonb_array_elements(body->'f') loop
  a:=v->((f->>0)::int);b:=v->((f->>1)::int);c:=v->((f->>2)::int);
  ax:=(a->>0)::double precision;az:=(a->>2)::double precision;
  bx:=(b->>0)::double precision;bz:=(b->>2)::double precision;
  cx:=(c->>0)::double precision;cz:=(c->>2)::double precision;
  if px<least(ax,bx,cx)-1e-7 or px>greatest(ax,bx,cx)+1e-7 or pz<least(az,bz,cz)-1e-7 or pz>greatest(az,bz,cz)+1e-7 then continue;end if;
  denom:=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);
  if abs(denom)<1e-9 then continue;end if;
  u:=((bz-cz)*(px-cx)+(cx-bx)*(pz-cz))/denom;
  w:=((cz-az)*(px-cx)+(ax-cx)*(pz-cz))/denom;
  if u< -1e-6 or w< -1e-6 or u+w>1.000001 then continue;end if;
  y:=u*(a->>1)::double precision+w*(b->>1)::double precision+(1-u-w)*(c->>1)::double precision;
  if result is null or (upper and y>result) or (not upper and y<result) then result:=y;end if;
 end loop;
 return result;
end $$;

-- Connected ground/upper support patch containing vertex-mean projection;
-- discrete conservative support screening, NOT full rigid-body physics.
create or replace function private.tower_v2_supported(candidate jsonb,others jsonb)
returns boolean language plpgsql immutable set search_path='' as $$
declare lo_x double precision:=(candidate->'lo'->>0)::double precision;lo_y double precision:=(candidate->'lo'->>1)::double precision;lo_z double precision:=(candidate->'lo'->>2)::double precision;
 hi_x double precision:=(candidate->'hi'->>0)::double precision;hi_z double precision:=(candidate->'hi'->>2)::double precision;
 dx double precision:=(hi_x-lo_x)/14;dz double precision:=(hi_z-lo_z)/14;
 ground boolean:=lo_y<=.001; mark boolean[]:=array_fill(false,array[225]);seen boolean[]:=array_fill(false,array[225]);
 px double precision;pz double precision;bottom double precision;top_y double precision;other_y double precision;other_body jsonb;
 xi int;zi int;idx int;com_x int;com_z int;start_idx int;queue int[]:=array[]::int[];head int:=1;tail int:=0;
 p int;rx int;rz int;neighbor int;area_count int:=0;min_margin double precision:='Infinity';boundary boolean;
begin
 if lo_y< -.0005 or dx<=0 or dz<=0 then return false;end if;
 for zi in 0..14 loop for xi in 0..14 loop
  px:=lo_x+dx*xi;pz:=lo_z+dz*zi;
  bottom:=private.tower_v2_surface_y(candidate,px,pz,false);
  if bottom is null then continue;end if;
  top_y:=case when ground then 0::double precision else null::double precision end;
  if not ground then
   for other_body in select value from jsonb_array_elements(others) loop
    if px<(other_body->'lo'->>0)::double precision or px>(other_body->'hi'->>0)::double precision or
       pz<(other_body->'lo'->>2)::double precision or pz>(other_body->'hi'->>2)::double precision or
       (other_body->'lo'->>1)::double precision>bottom+.018 then continue;end if;
    other_y:=private.tower_v2_surface_y(other_body,px,pz,true);
    if other_y is not null then top_y:=greatest(coalesce(top_y,other_y),other_y);end if;
   end loop;
  end if;
  if top_y is not null and bottom-top_y>= -.00035 and bottom-top_y<=.018 then mark[zi*15+xi+1]:=true;end if;
 end loop;end loop;
 com_x:=round(((candidate->'center'->>0)::double precision-lo_x)/dx);
 com_z:=round(((candidate->'center'->>2)::double precision-lo_z)/dz);
 if com_x<0 or com_x>14 or com_z<0 or com_z>14 then return false;end if;
 start_idx:=com_z*15+com_x+1;
 if not mark[start_idx] then return false;end if;
 queue:=array[start_idx];seen[start_idx]:=true;tail:=1;
 while head<=tail loop
  p:=queue[head];head:=head+1;area_count:=area_count+1;
  rx:=(p-1)%15;rz:=(p-1)/15;
  boundary:=rx=0 or rx=14 or rz=0 or rz=14;
  for neighbor in select unnest(array[case when rx>0 then p-1 else null end,case when rx<14 then p+1 else null end,
          case when rz>0 then p-15 else null end,case when rz<14 then p+15 else null end]) loop
   if neighbor is null then continue;end if;
   if not mark[neighbor] then boundary:=true;continue;end if;
   if not seen[neighbor] then seen[neighbor]:=true;queue:=array_append(queue,neighbor);tail:=tail+1;end if;
  end loop;
  if boundary then min_margin:=least(min_margin,sqrt(((rx-com_x)*dx)^2+((rz-com_z)*dz)^2));end if;
 end loop;
 return area_count>=7 and area_count*dx*dz>=.008 and min_margin>=.012;
end $$;

create or replace function private.tower_v2_valid_element(e jsonb)
returns boolean language plpgsql stable set search_path='' as $$
declare t text;v int;sx int;sy int;sz int;r int;x numeric;y numeric;z numeric;dims double precision[];
begin
 if jsonb_typeof(e)<>'object' or jsonb_typeof(e->'x')<>'number' or jsonb_typeof(e->'y')<>'number' or jsonb_typeof(e->'z')<>'number' then return false;end if;
 t:=e->>'type';if t not in ('medium','long','big') then return false;end if;
 sx:=(e->>'sx')::int;sy:=(e->>'sy')::int;sz:=(e->>'sz')::int;r:=(e->>'rotation')::int;v:=(e->>'variant')::int;
 if r is null or r not between 0 and 7 or v is null or v<0 or not exists(select 1 from private.tower_v2_shapes where type=t and variant=v) then return false;end if;
 if not (case t when 'medium' then (sx,sy,sz) in ((2,1,1),(2,2,1),(2,2,2))
             when 'long' then (sx,sy,sz) in ((3,1,1),(3,2,1),(4,1,1),(4,2,1),(5,1,1),(5,2,1))
             when 'big' then (sx,sy,sz) in ((2,3,3),(2,3,4),(3,4,4)) else false end) then return false;end if;
 x:=(e->>'x')::numeric;y:=(e->>'y')::numeric;z:=(e->>'z')::numeric;
 if not (x between 0 and 60 and y between 0 and 80 and z between 0 and 60) then return false;end if;
 if x<>round(x,5) or y<>round(y,5) or z<>round(z,5) then return false;end if;
 dims:=private.tower_v2_dims(e);
 if x+dims[1]>60 or y+dims[2]>80 or z+dims[3]>60 then return false;end if;
 return true;
exception when invalid_text_representation or numeric_value_out_of_range or division_by_zero then return false;
end $$;

create or replace function private.tower_v2_valid_place(candidate jsonb,items jsonb)
returns boolean language plpgsql stable set search_path='' as $$
declare e jsonb;body jsonb:=private.tower_v2_body(candidate);other jsonb;others jsonb:='[]'::jsonb;
begin
 for e in select value from jsonb_array_elements(items) loop
  other:=private.tower_v2_body(e);
  if private.tower_v2_collides(body,other) then return false;end if;
  others:=others||jsonb_build_array(other);
 end loop;
 return private.tower_v2_supported(body,others);
end $$;

create or replace function private.tower_v2_valid_remove(items jsonb)
returns boolean language plpgsql stable set search_path='' as $$
declare e jsonb;other jsonb;body jsonb;others jsonb;
begin
 for e in select value from jsonb_array_elements(items) loop
  body:=private.tower_v2_body(e);others:='[]'::jsonb;
  for other in select value from jsonb_array_elements(items) loop
   if other->>'id'<>e->>'id' then others:=others||jsonb_build_array(private.tower_v2_body(other));end if;
  end loop;
  if not private.tower_v2_supported(body,others) then return false;end if;
 end loop;
 return true;
end $$;

-- Snapshot has separate V2 elements; V1 elements are NEVER copied or mutated.
create or replace function private.get_tower_v2_snapshot(p_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();target uuid:=coalesce(p_user_id,auth.uid());a private.tower_accounts;items jsonb;
begin
 if uid is null then raise exception 'AUTH_REQUIRED';end if;
 if target=uid then
  insert into private.tower_accounts(user_id) values(uid) on conflict do nothing;
  perform 1 from private.tower_accounts where user_id=uid for update;
  perform private.tower_refresh_rewards(uid);
 end if;
 select * into a from private.tower_accounts where user_id=target;
 select coalesce(jsonb_agg(data order by created_at,id),'[]'::jsonb) into items from private.tower_v2_elements where user_id=target;
 return jsonb_build_object('format',2,'revision',coalesce(a.revision,0),'silver',case when uid=target then coalesce(a.silver,0) else null end,
  'gold',case when uid=target then coalesce(a.gold,0) else null end,'elements',items,'reward_mapping_version',1);
end $$;

create or replace function private.mutate_tower_v2(p_revision bigint,p_operation_id uuid,p_action text,p_element jsonb default null,p_element_id uuid default null,p_currency text default 'silver')
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); a private.tower_accounts;receipt private.tower_receipts;req jsonb;items jsonb;result jsonb;e jsonb;
 eid uuid;typ text;cost int;paid int;currency text;row_count int;
begin
 if uid is null then raise exception 'AUTH_REQUIRED';end if;
 if p_operation_id is null or p_revision is null then raise exception 'INVALID_REQUEST';end if;
 if p_action is null or p_action not in ('place','remove') then raise exception 'INVALID_ACTION';end if;
 req:=jsonb_build_array('tower_v2',p_revision,p_action,p_element,p_element_id,p_currency);
 insert into private.tower_accounts(user_id) values(uid) on conflict do nothing;
 select * into a from private.tower_accounts where user_id=uid for update;
 select * into receipt from private.tower_receipts where user_id=uid and operation_id=p_operation_id;
 if found then
  if receipt.request<>req then raise exception 'OPERATION_ID_REUSED';end if;
  return private.get_tower_v2_snapshot(null)||jsonb_build_object('replayed',true);
 end if;
 if a.revision<>p_revision then raise exception 'REVISION_CONFLICT';end if;
 perform private.tower_refresh_rewards(uid);
 select * into a from private.tower_accounts where user_id=uid;
 select coalesce(jsonb_agg(data order by created_at,id),'[]'::jsonb),count(*) into items,row_count from private.tower_v2_elements where user_id=uid;
 if p_action='place' then
  if p_currency not in ('silver','gold') or not private.tower_v2_valid_element(p_element) then raise exception 'INVALID_ELEMENT';end if;
  if row_count>=250 then raise exception 'ELEMENT_LIMIT';end if;
  eid:=(p_element->>'id')::uuid;
  if eid is null then raise exception 'INVALID_ELEMENT';end if;
  if exists(select 1 from private.tower_v2_elements where user_id=uid and id=eid) or
     exists(select 1 from jsonb_array_elements(a.elements) l where l->>0=eid::text) then raise exception 'ELEMENT_ID_EXISTS';end if;
  typ:=p_element->>'type';cost:=case typ when 'medium' then 4 when 'long' then 8 when 'big' then 24 end;
  if p_currency='gold' and typ<>'big' then raise exception 'USE_SILVER';end if;
  paid:=case when p_currency='gold' then cost/8 else cost end;
  if (p_currency='silver' and a.silver<paid) or (p_currency='gold' and a.gold<paid) then raise exception 'INSUFFICIENT_FUNDS';end if;
  e:=jsonb_build_object('id',eid,'type',typ,'x',p_element->'x','y',p_element->'y','z',p_element->'z',
   'sx',(p_element->>'sx')::int,'sy',(p_element->>'sy')::int,'sz',(p_element->>'sz')::int,'rotation',(p_element->>'rotation')::int,
   'variant',(p_element->>'variant')::int,'paidCurrency',p_currency,'paidAmount',paid);
  if not private.tower_v2_valid_place(e,items) then raise exception 'INVALID_PLACEMENT_OR_SUPPORT';end if;
  insert into private.tower_v2_elements(user_id,id,data) values(uid,eid,e);
  if p_currency='silver' then a.silver:=a.silver-paid;else a.gold:=a.gold-paid;end if;
 else
  if p_element_id is null then raise exception 'INVALID_ELEMENT';end if;
  select data into e from private.tower_v2_elements where user_id=uid and id=p_element_id;
  if e is null then raise exception 'ELEMENT_NOT_FOUND';end if;
  select coalesce(jsonb_agg(value),'[]'::jsonb) into items from jsonb_array_elements(items) where value->>'id'<>p_element_id::text;
  if not private.tower_v2_valid_remove(items) then raise exception 'DEPENDENT_ELEMENTS_REQUIRE_REMOVAL';end if;
  delete from private.tower_v2_elements where user_id=uid and id=p_element_id;
  if e->>'paidCurrency'='silver' then a.silver:=a.silver+(e->>'paidAmount')::int;
  else a.gold:=a.gold+(e->>'paidAmount')::int;end if;
 end if;
 update private.tower_accounts set revision=revision+1,silver=a.silver,gold=a.gold,updated_at=now() where user_id=uid;
 result:=private.get_tower_v2_snapshot(null);
 insert into private.tower_receipts(user_id,operation_id,request,response) values(uid,p_operation_id,req,result-'elements');
 return result;
end $$;

create or replace function public.get_tower_v2_snapshot(p_user_id uuid default null)
returns jsonb language sql security invoker set search_path='' as $$select private.get_tower_v2_snapshot(p_user_id)$$;
create or replace function public.mutate_tower_v2(p_revision bigint,p_operation_id uuid,p_action text,p_element jsonb default null,p_element_id uuid default null,p_currency text default 'silver')
returns jsonb language sql security invoker set search_path='' as $$select private.mutate_tower_v2(p_revision,p_operation_id,p_action,p_element,p_element_id,p_currency)$$;

-- No schema-wide REVOKE: other features have independent grants.
revoke execute on function private.tower_v2_dims(jsonb),private.tower_v2_body(jsonb),private.tower_v2_separating_axis(jsonb,jsonb,jsonb),
 private.tower_v2_collides(jsonb,jsonb),private.tower_v2_surface_y(jsonb,double precision,double precision,boolean),
 private.tower_v2_supported(jsonb,jsonb),private.tower_v2_valid_element(jsonb),private.tower_v2_valid_place(jsonb,jsonb),
 private.tower_v2_valid_remove(jsonb) from public,anon,authenticated;
revoke all on function private.get_tower_v2_snapshot(uuid),private.mutate_tower_v2(bigint,uuid,text,jsonb,uuid,text),
 public.get_tower_v2_snapshot(uuid),public.mutate_tower_v2(bigint,uuid,text,jsonb,uuid,text) from public,anon;
grant execute on function private.get_tower_v2_snapshot(uuid),private.mutate_tower_v2(bigint,uuid,text,jsonb,uuid,text),
 public.get_tower_v2_snapshot(uuid),public.mutate_tower_v2(bigint,uuid,text,jsonb,uuid,text) to authenticated;


CREATE TABLE private.tower_v3_roofs (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 id uuid NOT NULL,
 level_cells integer NOT NULL CHECK(level_cells BETWEEN 0 AND 79),
 points jsonb NOT NULL,
 cells jsonb NOT NULL,
 cell_count integer NOT NULL CHECK(cell_count BETWEEN 1 AND 7200),
 cost_silver integer NOT NULL CHECK(cost_silver=4*cell_count),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,id)
);
CREATE TABLE private.tower_v3_roof_receipts(
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 operation_id uuid NOT NULL,
 request jsonb NOT NULL,response jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,operation_id)
);
ALTER TABLE private.tower_v3_roofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.tower_v3_roof_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.tower_v3_roofs,private.tower_v3_roof_receipts FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION private.tower_roof_cells(p_points jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=''
AS $f$
DECLARE n int; i int;j int;x int;z int;ax int;az int;bx int;bz int;
 minx int:=59;maxx int:=0;minz int:=119;maxz int:=0;
 dx numeric;dz numeric;t numeric;inside boolean;close_edge boolean;result jsonb:='[]'::jsonb;
 cross_a numeric;cross_b numeric;cross_c numeric;cross_d numeric;
 cx int;cz int;ex int;ez int;
BEGIN
 IF p_points IS NULL OR jsonb_typeof(p_points)<>'array' THEN RAISE EXCEPTION 'INVALID_ROOF_POINTS';END IF;
 n:=jsonb_array_length(p_points);
 IF n NOT BETWEEN 1 AND 64 THEN RAISE EXCEPTION 'INVALID_ROOF_POINTS';END IF;
 FOR i IN 0..n-1 LOOP
  IF jsonb_typeof(p_points->i)<>'array' OR jsonb_array_length(p_points->i)<>2 OR
   (p_points->i->>0)!~'^[0-9]+$' OR (p_points->i->>1)!~'^[0-9]+$'
  THEN RAISE EXCEPTION 'INVALID_ROOF_POINTS';END IF;
  ax:=(p_points->i->>0)::int;az:=(p_points->i->>1)::int;
  IF ax NOT BETWEEN 0 AND 59 OR az NOT BETWEEN 0 AND 119 THEN RAISE EXCEPTION 'ROOF_OUTSIDE_PARCEL';END IF;
  IF i>0 AND p_points->i=p_points->(i-1) THEN RAISE EXCEPTION 'INVALID_ROOF_POINTS';END IF;
  minx:=least(minx,ax);maxx:=greatest(maxx,ax);
  minz:=least(minz,az);maxz:=greatest(maxz,az);
 END LOOP;
 IF n>1 AND p_points->0=p_points->(n-1) THEN RAISE EXCEPTION 'INVALID_ROOF_POINTS';END IF;
 IF n>=4 THEN
  FOR i IN 0..n-1 LOOP FOR j IN i+2..n-1 LOOP
   IF i=0 AND j=n-1 THEN CONTINUE;END IF;
   ax:=(p_points->i->>0)::int;az:=(p_points->i->>1)::int;
   bx:=(p_points->((i+1)%n)->>0)::int;bz:=(p_points->((i+1)%n)->>1)::int;
   cx:=(p_points->j->>0)::int;cz:=(p_points->j->>1)::int;
   ex:=(p_points->((j+1)%n)->>0)::int;ez:=(p_points->((j+1)%n)->>1)::int;
   cross_a:=(bx-ax)*(cz-az)-(bz-az)*(cx-ax);
   cross_b:=(bx-ax)*(ez-az)-(bz-az)*(ex-ax);
   cross_c:=(ex-cx)*(az-cz)-(ez-cz)*(ax-cx);
   cross_d:=(ex-cx)*(bz-cz)-(ez-cz)*(bx-cx);
   IF (cross_a*cross_b<0 AND cross_c*cross_d<0) OR
    (cross_a=0 AND cx BETWEEN least(ax,bx) AND greatest(ax,bx) AND cz BETWEEN least(az,bz) AND greatest(az,bz)) OR
    (cross_b=0 AND ex BETWEEN least(ax,bx) AND greatest(ax,bx) AND ez BETWEEN least(az,bz) AND greatest(az,bz)) OR
    (cross_c=0 AND ax BETWEEN least(cx,ex) AND greatest(cx,ex) AND az BETWEEN least(cz,ez) AND greatest(cz,ez)) OR
    (cross_d=0 AND bx BETWEEN least(cx,ex) AND greatest(cx,ex) AND bz BETWEEN least(cz,ez) AND greatest(cz,ez))
   THEN RAISE EXCEPTION 'ROOF_SELF_INTERSECTION';END IF;
  END LOOP;END LOOP;
 END IF;
 FOR x IN minx..maxx LOOP FOR z IN minz..maxz LOOP
  inside:=false;close_edge:=false;
  IF n=1 AND x=(p_points->0->>0)::int AND z=(p_points->0->>1)::int THEN close_edge:=true;END IF;
  FOR i IN 0..n-1 LOOP
   j:=(i+1)%n;
   ax:=(p_points->i->>0)::int;az:=(p_points->i->>1)::int;
   bx:=(p_points->j->>0)::int;bz:=(p_points->j->>1)::int;
   dx:=bx-ax;dz:=bz-az;
   IF dx=0 AND dz=0 THEN CONTINUE;END IF;
   t:=greatest(0,least(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));
   IF (x-ax-t*dx)^2+(z-az-t*dz)^2<=0.25000001 THEN close_edge:=true;END IF;
   IF n>=3 AND ((az>z)<>(bz>z)) AND x<ax+dx*(z-az)/nullif(dz,0) THEN inside:=NOT inside;END IF;
  END LOOP;
  IF inside OR close_edge THEN result:=result||jsonb_build_array(jsonb_build_array(x,z));END IF;
 END LOOP;END LOOP;
 RETURN result;
END $f$;
CREATE OR REPLACE FUNCTION private.tower_roof_snapshot(uid uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $f$
 SELECT jsonb_build_object(
  'roofs',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'level',r.level_cells,'points',r.points,'cells',r.cells,'cost',r.cost_silver) ORDER BY r.created_at,r.id) FROM private.tower_v3_roofs r WHERE r.user_id=uid),'[]'::jsonb),
  'balance',coalesce((SELECT a.silver FROM private.tower_accounts a WHERE a.user_id=uid),0))
$f$;
REVOKE ALL ON FUNCTION private.tower_roof_snapshot(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.get_tower_roof_snapshot(p_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE uid uuid:=auth.uid();
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
 IF p_user_id IS NOT NULL AND uid<>p_user_id THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 RETURN private.tower_roof_snapshot(uid);
END $f$;
REVOKE ALL ON FUNCTION public.get_tower_roof_snapshot(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_tower_roof_snapshot(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION private.mutate_tower_roof(p_operation_id uuid,p_points jsonb,p_level int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE uid uuid:=auth.uid(); old_receipt private.tower_v3_roof_receipts;
 req jsonb; cc jsonb; cnt int;price int;cell jsonb;b jsonb;sections jsonb;
 gx int;gz int;px int;py int;pz int;dims int[];supported boolean;new_balance bigint;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
 IF p_operation_id IS NULL OR p_level IS NULL OR p_level NOT BETWEEN 0 AND 79 THEN RAISE EXCEPTION 'INVALID_ROOF_REQUEST';END IF;
 req:=jsonb_build_array('roof_v1',p_points,p_level);
 INSERT INTO private.tower_v3_state(user_id) VALUES(uid) ON CONFLICT DO NOTHING;
 PERFORM 1 FROM private.tower_v3_state WHERE user_id=uid FOR UPDATE;
 SELECT * INTO old_receipt FROM private.tower_v3_roof_receipts WHERE user_id=uid AND operation_id=p_operation_id;
 IF FOUND THEN
  IF old_receipt.request<>req THEN RAISE EXCEPTION 'OPERATION_ID_REUSED';END IF;
  RETURN old_receipt.response||jsonb_build_object('replayed',true);
 END IF;
 cc:=private.tower_roof_cells(p_points);cnt:=jsonb_array_length(cc);price:=cnt*4;
 IF cnt<1 OR cnt>7200 THEN RAISE EXCEPTION 'INVALID_ROOF_AREA';END IF;
 sections:=private.tower_v3_snapshot_rows(uid);
 FOR cell IN SELECT value FROM jsonb_array_elements(cc) LOOP
  gx:=(cell->>0)::int;gz:=(cell->>1)::int;supported:=false;
  FOR b IN SELECT value FROM jsonb_array_elements(sections) LOOP
   dims:=private.tower_v3_size(b->>'sectionId',(b->>'rotation')::int);
   px:=(b->>'x')::int;py:=(b->>'y')::int;pz:=(b->>'z')::int;
   IF py+dims[2]=p_level AND gx BETWEEN px-2 AND px+dims[1]+1 AND gz BETWEEN pz-2 AND pz+dims[3]+1 THEN supported:=true;END IF;
   IF b->>'type'='masonry_section' AND py<=p_level AND py+dims[2]>p_level AND
    gx>=px AND gx<px+dims[1] AND gz>=pz AND gz<pz+dims[3] THEN RAISE EXCEPTION 'ROOF_COLLISION';END IF;
  END LOOP;
  IF NOT supported THEN RAISE EXCEPTION 'ROOF_SUPPORT_REQUIRED';END IF;
 END LOOP;
 IF EXISTS(
  SELECT 1 FROM private.tower_v3_roofs r,jsonb_array_elements(r.cells) c
   WHERE r.user_id=uid AND r.level_cells=p_level
    AND c.value IN (SELECT value FROM jsonb_array_elements(cc))
 ) THEN RAISE EXCEPTION 'ROOF_OVERLAP';END IF;
 INSERT INTO private.tower_accounts(user_id) VALUES(uid) ON CONFLICT DO NOTHING;
 PERFORM 1 FROM private.tower_accounts WHERE user_id=uid FOR UPDATE;
 PERFORM private.tower_refresh_rewards(uid);
 UPDATE private.tower_accounts SET silver=silver-price WHERE user_id=uid AND silver>=price RETURNING silver INTO new_balance;
 IF NOT FOUND THEN RAISE EXCEPTION 'INSUFFICIENT_COINS';END IF;
 INSERT INTO private.tower_v3_roofs(user_id,id,level_cells,points,cells,cell_count,cost_silver)
 VALUES(uid,p_operation_id,p_level,p_points,cc,cnt,price);
 INSERT INTO private.tower_v3_roof_receipts(user_id,operation_id,request,response)
 VALUES(uid,p_operation_id,req,private.tower_roof_snapshot(uid));
 RETURN private.tower_roof_snapshot(uid);
END $f$;
REVOKE ALL ON FUNCTION private.mutate_tower_roof(uuid,jsonb,integer) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.mutate_tower_roof(p_operation_id uuid,p_points jsonb,p_level int)
RETURNS jsonb LANGUAGE sql SET search_path=''
AS $f$ SELECT private.mutate_tower_roof(p_operation_id,p_points,p_level) $f$;
REVOKE ALL ON FUNCTION public.mutate_tower_roof(uuid,jsonb,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mutate_tower_roof(uuid,jsonb,integer) TO authenticated;
CREATE OR REPLACE FUNCTION private.tower_roofs_on_reset()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
BEGIN
 IF NEW.reset_at IS DISTINCT FROM OLD.reset_at THEN
  DELETE FROM private.tower_v3_roofs WHERE user_id=NEW.user_id;
 END IF;
 RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION private.tower_roofs_on_reset() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER tower_roofs_clear_on_reset AFTER UPDATE OF reset_at ON private.tower_v3_state
 FOR EACH ROW EXECUTE FUNCTION private.tower_roofs_on_reset();

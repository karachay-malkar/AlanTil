import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const get=p=>readFileSync(new URL(p,root),'utf8');
const schema='supabase/migrations/20261012180000_tower_v2_authoritative.sql';
const seed='supabase/migrations/20261012180100_tower_v2_authored_shapes.sql';
test('V2 uses isolated saved elements and the existing transactional wallet',()=>{
 const s=get(schema);assert.match(s,/private\.tower_v2_elements/);assert.match(s,/for update/);assert.match(s,/private\.tower_accounts/);assert.match(s,/private\.tower_receipts/);assert.match(s,/REVISION_CONFLICT/);assert.match(s,/OPERATION_ID_REUSED/);
});
test('V2 authority recomputes collision and connected physical-mesh support server-side',()=>{
 const s=get(schema);assert.match(s,/tower_v2_collides/);assert.match(s,/tower_v2_supported/);assert.match(s,/tower_v2_surface_y/);assert.match(s,/tower_v2_valid_place/);assert.match(s,/tower_v2_valid_remove/);assert.match(s,/tower_v2_separating_axis/);assert.doesNotMatch(s,/p_element->>'valid'|p_element->>'support'/);
});
test('V2 RPC scope cannot expose private tables',()=>{
 const s=get(schema);assert.match(s,/auth\.uid\(\)/);assert.match(s,/revoke all on.*tower_v2_elements/is);assert.match(s,/grant execute.*authenticated/is);
});
test('V2 shape seed stores true authored face indices and no generated primitives',()=>{
 const s=get(seed);assert.match(s,/insert into private\.tower_v2_shapes/);assert.match(s,/medium/);assert.match(s,/long/);assert.match(s,/big/);assert.doesNotMatch(s,/cube_geometry|BoxGeometry|procedural_pebble/);
});
test('frontend V2 mutates only dedicated RPC and never V1 tower elements',()=>{
 const s=get('src/features/tower/index.js');const r=get('src/features/tower/repository.js');
 assert.match(r,/mutate_tower_v2/);assert.match(r,/get_tower_v2_snapshot/);
 assert.match(s,/v2Play/);assert.match(s,/mutateTowerV2/);assert.match(s,/loadTowerV2/);
});

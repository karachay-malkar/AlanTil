import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {roofBeamId,roofBeamLength,ROOF_BEAM_VERSION,positionRoofBeamAgainst} from '../packages/tower-game/roof-beam.mjs';
import {prefabBounds,validatePrefabPlacement} from '../packages/tower-game/prefab-layout.mjs';
import {APPROVED_PREFAB_VERSION} from '../packages/tower-game/approved-prefab.mjs';
const stone=(id,x,y,z)=>({id,type:'masonry_section',sectionId:'1x1x1',variant:0,rotation:0,x,y,z,geometryVersion:APPROVED_PREFAB_VERSION});
const beam=(id,n=16,x=0,y=1,z=0,rotation=0)=>({id,type:'roof_beam',sectionId:roofBeamId(n),geometryVersion:ROOF_BEAM_VERSION,variant:0,rotation,x,y,z});
test('variable beam lengths and rotations are actual 3D footprints',()=>{
 assert.equal(roofBeamLength('roof-beam-16'),16);assert.equal(roofBeamLength('roof-beam-41'),null);
 assert.deepEqual(prefabBounds(beam('a')).size,[16,1,1]);
 assert.deepEqual(prefabBounds(beam('a',16,0,1,0,1)).size,[1,1,16]);
});
test('a single support allows long asymmetric overhang, without stability limits',()=>{
 const support=stone('s',8,0,0);
 assert.equal(validatePrefabPlacement([support],beam('b')).ok,true);
 assert.equal(validatePrefabPlacement([],beam('b')).ok,false);
 assert.equal(validatePrefabPlacement([support],beam('b',16,20,1,0)).ok,false);
});
test('beam translation follows beam axis, without changing length',()=>{
 const support=stone('s',9,0,10),hit={block:support,position:[2.25,.25,2.5],supportTop:1};
 const a=positionRoofBeamAgainst(beam('b'),hit,0),b=positionRoofBeamAgainst(beam('b'),hit,2);
 assert.equal(a.x,1);assert.equal(b.x,3);
 const c=positionRoofBeamAgainst(beam('b',16,0,1,0,1),hit,2);
 assert.equal(c.z,4);
});
test('masonry placement does not depend on floating beams',()=>{
 assert.equal(validatePrefabPlacement([beam('floating',16,4,8,4)],stone('foundation',4,0,4)).ok,true);
});
test('migration and UI explicitly allow deletion of a beam support',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261031100000_tower_roof_beams_172.sql',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../src/features/tower/index.js',import.meta.url),'utf8');
 assert.match(sql,/tower_v3_beam_has_anchor/);assert.match(sql,/NOT \(box->>'support'\)::boolean THEN CONTINUE/);
 assert.match(ui,/b.type!=='roof_beam'&&!validatePrefabPlacement/);
});

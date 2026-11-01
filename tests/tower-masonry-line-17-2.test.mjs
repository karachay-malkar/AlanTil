import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planMasonryLine,checkMasonryLine,MAX_MASONRY_LINE} from '../packages/tower-game/masonry-line.mjs';
import {prefabBounds} from '../packages/tower-game/prefab-layout.mjs';
import {resolvePrefabJoints} from '../packages/tower-game/prefab-joints.mjs';
import {APPROVED_PREFAB_VERSION} from '../packages/tower-game/approved-prefab.mjs';
import {WINDOW_JOINT_FILES} from '../packages/tower-game/window-prefab.mjs';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const first=(type,x=10,z=10,rotation=0)=>({
 id:'00000000-0000-4000-8000-000000000001',type:'masonry_section',sectionId:type,
 variant:0,rotation,x,y:0,z,geometryVersion:APPROVED_PREFAB_VERSION
});
const joints=(all)=>resolvePrefabJoints(all,{version:APPROVED_PREFAB_VERSION,connectors:WINDOW_JOINT_FILES});

test('one point generates a single approved section without a separate placement mode',()=>{
 const a=first('2x2x2');
 const p=planMasonryLine({first:a});
 assert.ok(p.ok);assert.equal(p.sections.length,1);assert.equal(p.sections[0],a);
});
test('two points build a contiguous straight row with no overlap and no gaps',()=>{
 const p=planMasonryLine({first:first('2x2x2'),last:{x:18,z:10},seed:17});
 assert.equal(p.sections.length,5);assert.equal(p.axis,'x');
 for(let i=0;i<p.sections.length;i++){
  const b=p.sections[i];
  assert.equal(b.x,10+2*i);assert.equal(b.z,10);
  assert.equal(b.rotation>=0&&b.rotation<=3,true);
  assert.equal(b.variant,p.sections[0].variant,'all modules keep chosen variant');
  assert.equal(b.rotation,p.sections[0].rotation,'all modules keep chosen rotation');
 }
 assert.ok(checkMasonryLine([],p.sections,{},joints).ok);
});
test('asymmetric masonry retains player-selected orientation along the row',()=>{
 const a=first('2x3x4',10,10,0);
 const p=planMasonryLine({first:a,last:{x:10,z:22},seed:3});
 assert.equal(p.sections.length,4);assert.equal(p.axis,'z');
 for(let i=0;i<p.sections.length;i++){
  assert.equal(p.sections[i].z,10+4*i);
  assert.deepEqual(prefabBounds(p.sections[i]).size,[2,3,4]);
  assert.equal(p.sections[i].rotation%2,0);
 }
 assert.ok(checkMasonryLine([],p.sections,{},joints).ok);
});
test('long rows rejected, selected variant never randomized',()=>{
 const a=first('1x1x1');
 assert.equal(planMasonryLine({first:a,last:{x:90,z:10}}).reason,'LINE_TOO_LONG');
 const firstRun=planMasonryLine({first:a,last:{x:14,z:10},seed:252});
 const replay=planMasonryLine({first:a,last:{x:14,z:10},seed:252});
 assert.deepEqual(firstRun,replay);
 assert.equal(firstRun.sections.length,5);
 assert.equal(new Set(firstRun.sections.map(s=>s.variant)).size,1);
 const chosen={...first('1x1x1'),variant:1,rotation:3};
 const all=planMasonryLine({first:chosen,last:{x:13,z:10}}).sections;
 assert.ok(all.every(b=>b.variant===1&&b.rotation===3));
});
test('line invalidates when an occupied grid cell intersects a new section',()=>{
 const candidate=planMasonryLine({first:first('2x2x2'),last:{x:16,z:10}});
 const blocker={...first('2x2x2',12,10),id:'00000000-0000-4000-8000-000000000999'};
 assert.equal(checkMasonryLine([blocker],candidate.sections,{},joints).ok,false);
});
test('UI supports movable first/end points and an undo action, never randomization',()=>{
 const ui=source('src/features/tower/index.js');
 const scene=source('src/features/tower/prefab-scene.js');
 const repo=source('src/features/tower/repository.js');
 const sql=source('supabase/migrations/20261101172000_tower_v3_atomic_masonry_line_172.sql');
 for(const token of ['planMasonryLine','checkMasonryLine','data-undo','placeTowerLine','s.lineStart','s.lineEnd','onEndpointMove','setLineDraft'])assert.ok(ui.includes(token));
 assert.doesNotMatch(ui,/data-shuffle|data-line-shuffle|lineSeed/);
 assert.match(scene,/function endpointPointerDown/);
 assert.match(scene,/function endpointPointerMove/);
 assert.match(scene,/setPointerCapture/);
 assert.match(scene,/function dragEndpoint/);
 assert.match(scene,/Array\.isArray\(block\)/);
 assert.match(repo,/mutate_tower_v3_line/);
 assert.match(sql,/private\.tower_v3_valid_layout\(uid,all_sections\|\|canon\)/);
 assert.match(sql,/INSERT INTO private\.tower_v3_receipts/);
 assert.match(sql,/INSUFFICIENT_TEKMET/);
});
test('two-finger pan is enabled but constrained by zoom and 10m site context',()=>{
 const scene=source('src/features/tower/prefab-scene.js');
 assert.match(scene,/controls\.enablePan=true/);
 assert.match(scene,/THREE\.TOUCH\.DOLLY_PAN/);
 assert.match(scene,/Math\.pow\(zoom,\.75\)/);
 assert.match(scene,/1\+3\*Math\.pow\(zoom,\.7\)/);
 assert.match(scene,/SITE\.widthM\/2\+10/);
});

test('camera reacts to drag without using one-finger orbit and returns normal sensitivity when far',()=>{
 const scene=source('src/features/tower/prefab-scene.js');
 assert.match(scene,/controls.enabled=false;pressed=null/);
 assert.match(scene,/markerDrag=null;controls.enabled=true/);
 assert.match(scene,/activePointers.size>=2/);
 assert.match(scene,/renderer.domElement.addEventListener\('pointermove',endpointPointerMove,true\)/);
});

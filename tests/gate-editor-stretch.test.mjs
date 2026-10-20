/** Approved manual gate stretch: exact source recipe, stable prefab persistence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {
 applyGateEditorStretch,GATE_EDITOR_STRETCH_VERSION,
 GATE_EDITOR_STRETCH_SCALE_X,GATE_EDITOR_STRETCH_PART,
} from '../src/features/tower/gate-editor-stretch.mjs';
import {
 GATE_PREFAB_ID,GATE_PREFAB_VERSION,GATE_PREFAB_FILE,GATE_PREFAB_SPEC
} from '../packages/tower-game/gate-prefab.mjs';
import {PREFAB_TYPES,prefabBounds,validatePrefabPlacement} from '../packages/tower-game/prefab-layout.mjs';

const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root));
const archivePath='assets/tower/prefabs/architectural/gate-18x10x2-editor-stretch-v8.json';
const archiveBytes=read(archivePath);
const original=JSON.parse(archiveBytes);
const approved=original.recipe.architectures[0];

test('uploaded manual export is archived byte-identically with original scale and no rocks',()=>{
 assert.equal(createHash('sha256').update(archiveBytes).digest('hex'),'36d5ce38296e2823f83bddf85c0121111fcdcd213cbf67739d09f36f8e5ecf53');
 assert.equal(original.recipe.version,'common100-mixed-2');
 assert.deepEqual(original.recipe.stones,[]);
 assert.equal(original.recipe.architectures.length,1);
 assert.equal(approved.asset,'gate');
 assert.equal(GATE_EDITOR_STRETCH_SCALE_X,approved.scale[0]);
 assert.equal(approved.parts[String(GATE_EDITOR_STRETCH_PART)].scale[0],GATE_EDITOR_STRETCH_SCALE_X);
 assert.deepEqual(approved.scale.slice(1),[1,1]);
 assert.deepEqual(approved.quaternion,[0,0,0,1]);
 for(const [index,part] of Object.entries(approved.parts)){
  assert.deepEqual(part.position,[0,0,0]);
  assert.equal(part.quaternion.slice(0,3).every(n=>n===0),true);
  assert.equal(Math.abs(part.quaternion[3]),1);
  if(index!=='101')assert.deepEqual(part.scale,[1,1,1]);
 }
 assert.equal(GATE_EDITOR_STRETCH_VERSION,'gate-editor-stretch-v8.1');
});

test('apply uses exactly the two X multipliers without moving or resetting any source mesh',()=>{
 const nodes=Array.from({length:592},(_,i)=>({
  isMesh:true,name:'source mesh '+i,
  position:{x:i*.0001,y:i*.0002,z:i*.0003},
  quaternion:{x:0,y:0,z:0,w:1},scale:{x:1,y:1,z:1}
 }));
 const gate={scale:{x:1,y:1,z:1},position:{x:0,y:0,z:0},
  updateMatrixWorld(force){assert.equal(force,true);},
  traverse(cb){cb(this);nodes.forEach(cb);}
 };
 const before=JSON.stringify(nodes.map(n=>({position:n.position,quaternion:n.quaternion})));
 assert.equal(applyGateEditorStretch(gate),gate);
 assert.equal(gate.scale.x,1.011);
 assert.equal(nodes[101].scale.x,1.011);
 assert.equal(nodes[100].scale.x,1);
 assert.equal(nodes[140].scale.x,1);
 assert.equal(nodes[180].scale.x,1);
 assert.equal(nodes[591].scale.x,1);
 assert.equal(gate.scale.y,1);assert.equal(gate.scale.z,1);
 assert.equal(JSON.stringify(nodes.map(n=>({position:n.position,quaternion:n.quaternion}))),before);
 assert.equal(gate.position.x,0);
});

test('mismatched GLB mesh ordering is rejected before accidental part editing',()=>{
 const gate={scale:{x:1},traverse(cb){for(let i=0;i<101;i++)cb({isMesh:true,scale:{x:1}});}};
 assert.throws(()=>applyGateEditorStretch(gate),/part 101 missing/);
 assert.equal(gate.scale.x,1);
});

test('legacy and new placements remain the same section and grid footprint',()=>{
 assert.equal(GATE_PREFAB_ID,'gate-18x10x2');
 assert.equal(GATE_PREFAB_VERSION,'17.6-gate.1');
 assert.equal(GATE_PREFAB_FILE,'/assets/tower/prefabs/architectural/gate-18x10x2-v9.glb');
 assert.deepEqual(GATE_PREFAB_SPEC.size,[18,10,2]);
 assert.deepEqual(PREFAB_TYPES.find(x=>x.id===GATE_PREFAB_ID).size,[18,10,2]);
 const block={id:'gate-test',type:'masonry_section',sectionId:GATE_PREFAB_ID,variant:0,rotation:0,x:0,y:0,z:0,geometryVersion:GATE_PREFAB_VERSION};
 assert.deepEqual(prefabBounds(block).size,[18,10,2]);
 assert.equal(validatePrefabPlacement([],block).ok,true);
 assert.equal(validatePrefabPlacement([],{...block,rotation:1}).ok,true);
});

test('tower rendering loads pre-fitted v9 without applying archived v8 stretch',()=>{
 const scene=read('src/features/tower/prefab-scene.js').toString();
 const mount=read('src/features/tower/index.js').toString();
 const router=read('src/app/router.js').toString();
 const gateBlock=scene.slice(scene.indexOf('if(block.sectionId===GATE_PREFAB_ID)'),scene.indexOf('if(block.sectionId===DOOR_PREFAB_ID)'));
 assert.match(gateBlock,/applyGateSurfaces\(gate,door.scene,stoneMaterial\)/);
 assert.doesNotMatch(gateBlock,/applyGateEditorStretch\(gate\)/);
 assert.match(gateBlock,/already contains the rock-edge fitting/);
 assert.match(gateBlock,/gate.position.y\+=targetBottom-bounds.min.y/);
 assert.doesNotMatch(gateBlock,/gate.position.x|gate.position.z/);
 assert.match(scene,/const model=await getPrefab\(block\)/);
 assert.match(mount,/GATE_PREFAB_VERSION/);
 assert.match(router,/TOWER_ASSET_VERSION = "17\.5\.8-gate-v9-rockfit\.1"/);
});

test('current gate v9 GLB is complete and contains the historic mesh index range',()=>{
 const glb=read(GATE_PREFAB_FILE.slice(1));
 assert.equal(glb.subarray(0,4).toString('ascii'),'glTF');
 assert.equal(glb.readUInt32LE(8),glb.length);
 assert.equal(glb.subarray(16,20).toString('ascii'),'JSON');
 const doc=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString('utf8'));
 const scene=doc.scenes?.[doc.scene??0];
 assert.ok(scene&&doc.nodes?.length);
 const countMeshes=nodeIndex=>{
  const node=doc.nodes[nodeIndex];
  const own=node.mesh===undefined?0:doc.meshes[node.mesh].primitives.length;
  return own+(node.children||[]).reduce((s,i)=>s+countMeshes(i),0);
 };
 const meshCount=(scene.nodes||[]).reduce((s,i)=>s+countMeshes(i),0);
 assert.ok(meshCount>591,'original GLB should contain the exported mesh 591, got '+meshCount);
});

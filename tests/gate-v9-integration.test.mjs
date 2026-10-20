/** Regression for promotion of the approved v9 gate to the actual tower game. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {
 GATE_PREFAB_ID,GATE_PREFAB_VERSION,GATE_PREFAB_FILE,
 GATE_RENDER_VERSION,GATE_PREFAB_SPEC
} from '../packages/tower-game/gate-prefab.mjs';
import {prefabBounds,validatePrefabPlacement} from '../packages/tower-game/prefab-layout.mjs';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root));
const metrics=JSON.parse(read('gate-fit-review/candidate-v9-metrics.json'));
const fingerprint=data=>createHash('sha256').update(data).digest('hex');

function parseGLB(buffer){
 assert.equal(buffer.toString('ascii',0,4),'glTF');
 assert.equal(buffer.readUInt32LE(4),2);
 assert.equal(buffer.readUInt32LE(8),buffer.length);
 const jsonLength=buffer.readUInt32LE(12);
 assert.equal(buffer.toString('ascii',16,20),'JSON');
 return JSON.parse(buffer.subarray(20,20+jsonLength).toString('utf8'));
}
function sceneParts(doc){
 const items=[];
 function walk(idx){
  const node=doc.nodes[idx];
  if(node.mesh!==undefined)for(const primitive of doc.meshes[node.mesh].primitives){
   const mat=doc.materials?.[primitive.material]?.name||'';
   items.push({name:node.name||'',kind:mat.includes('ROCK')?'rock':mat.includes('WOOD')?'wood':mat.includes('IRON')?'iron':'other'});
  }
  for(const child of node.children||[])walk(child);
 }
 for(const idx of doc.scenes[doc.scene??0].nodes)walk(idx);
 return items;
}

test('production game gate points at the byte-exact approved v9 geometry',()=>{
 assert.equal(GATE_PREFAB_FILE,'/assets/tower/prefabs/architectural/gate-18x10x2-v9.glb');
 assert.equal(GATE_RENDER_VERSION,'17.6-gate.1-v9-rockfit.1');
 const production=read(GATE_PREFAB_FILE.slice(1));
 const approved=read('gate-fit-review/gate-18x10x2-v9-candidate.glb');
 assert.equal(fingerprint(production),fingerprint(approved),'original approved GLB should be copied without re-encoding');
 assert.equal(production.length,metrics.outputBytes);
 assert.ok(production.length>5_000_000);
 const doc=parseGLB(production),parts=sceneParts(doc);
 assert.equal(parts.length,680,'v9 comprises 594 original parts plus 86 stone infill meshes');
 assert.equal(parts.filter(x=>x.kind==='rock').length,572);
 assert.equal(parts.filter(x=>x.kind==='wood').length,26);
 assert.equal(parts.filter(x=>x.kind==='iron').length,82);
 assert.equal(parts.filter(x=>x.name.startsWith('V9_EDGE_')).length,86);
 assert.deepEqual(metrics.dimensionsMeters,[4.5,2.5,.5]);
 assert.deepEqual(metrics.rockTargetGameBounds,{min:[-2.25,-1.25,-.25],max:[2.25,1.25,.25]});
 assert.equal(metrics.fit.openingWidthMeters,2);
 assert.ok(metrics.edgeProxy.coveredFraction>=.96);
});

test('previous approved v7 gate and source v8 JSON remain available for comparison',()=>{
 const v7=parseGLB(read('assets/tower/prefabs/architectural/gate-18x10x2-v7.glb'));
 assert.equal(sceneParts(v7).length,594);
 const v8=JSON.parse(read('assets/tower/prefabs/architectural/gate-18x10x2-editor-stretch-v8.json'));
 assert.equal(v8.recipe.architectures[0].scale[0],1.011);
 const editor=read('src/features/masonry/architecture-assets.js').toString();
 assert.match(editor,/gate-18x10x2-v7\.glb/);
 assert.match(editor,/gate-18x10x2-v9\.glb/);
});

test('tower scene loads v9 directly, with PBR, without double-applying the v8 stretch',()=>{
 const scene=read('src/features/tower/prefab-scene.js').toString();
 const text=scene.slice(scene.indexOf('if(block.sectionId===GATE_PREFAB_ID)'),scene.indexOf('if(block.sectionId===DOOR_PREFAB_ID)'));
 assert.match(text,/GATE_PREFAB_FILE\+'\?v='\+encodeURIComponent\(GATE_RENDER_VERSION\)/);
 assert.match(text,/applyGateSurfaces\(gate,door\.scene,stoneMaterial\)/);
 assert.match(text,/gate\.position\.y\+=targetBottom-bounds\.min\.y/);
 assert.doesNotMatch(scene,/import \{applyGateEditorStretch\}/);
 assert.doesNotMatch(text,/applyGateEditorStretch\(gate\)/);
 assert.doesNotMatch(text,/gate\.scale\.x/);
 assert.match(scene,/setPosition\(group,block\)/);
 const router=read('src/app/router.js').toString();
 assert.match(router,/TOWER_ASSET_VERSION = "17\.5\.8-gate-v9-rockfit\.1"/);
 const tower=read('src/features/tower/index.js').toString();
 assert.match(tower,/prefab-scene\.js\?v=gate-v9-rockfit\.1/);
});

test('old saved gates still resolve, all rotations retain 25cm placement and opening',()=>{
 assert.equal(GATE_PREFAB_ID,'gate-18x10x2');
 assert.equal(GATE_PREFAB_VERSION,'17.6-gate.1','do not migrate existing saved construction data');
 assert.deepEqual([...GATE_PREFAB_SPEC.size],[18,10,2]);
 assert.deepEqual(GATE_PREFAB_SPEC.architecturalOpening,{width:2,height:2,depth:.5});
 for(let r=0;r<4;r++){
  const saved={id:'saved-legacy-gate',type:'masonry_section',sectionId:GATE_PREFAB_ID,
   geometryVersion:'17.6-gate.1',variant:0,rotation:r,x:0,y:0,z:0};
  assert.equal(validatePrefabPlacement([],saved,{maxVariants:1}).ok,true);
  assert.deepEqual(prefabBounds(saved).size,r%2?[2,10,18]:[18,10,2]);
 }
});

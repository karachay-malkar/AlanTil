import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url));
const text=p=>read(p).toString('utf8');
const dir='assets/tower/approved-library/architecture/';
function meta(path){
 const b=read(dir+path);
 assert.equal(b.toString('ascii',0,4),'glTF');
 assert.equal(b.readUInt32LE(4),2);
 const j=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));
 return {bytes:b.length,scene:{
  nodes:(j.nodes||[]).map(n=>({name:n.name??null,matrix:n.matrix??null,
   translation:n.translation??null,rotation:n.rotation??null,scale:n.scale??null,
   mesh:n.mesh??null,children:n.children??null,skin:n.skin??null})),
  meshes:(j.meshes||[]).map(n=>n.name??null),
  materials:(j.materials||[]).map(n=>n.name??null),
  scenes:j.scenes||[],animations:(j.animations||[]).map(n=>({name:n.name??null,channels:n.channels?.length||0}))
 },extensions:j.extensionsUsed||[]};
}
test('three optimized architecture models are smaller and preserve geometry addressing',()=>{
 for(const [name,suffix,extension] of [
  ['window-wood-v3','-webp','EXT_texture_webp'],
  ['door-wood-v1','-webp','EXT_texture_webp'],
  ['door-7x9x2-stone-v1','-meshopt','EXT_meshopt_compression']
 ]){
  const original=meta(name+'.glb'),candidate=meta('optimized/'+name+suffix+'.glb');
  assert.ok(candidate.bytes<original.bytes*.95,name+' must save at least 5%');
  assert.deepEqual(candidate.scene,original.scene,name+' node/material structure must remain unchanged');
  assert.ok(candidate.extensions.includes(extension),name+' must include supported compression extension');
 }
});
test('tower and editor reference only approved optimized variants',()=>{
 const door=text('packages/tower-game/door-prefab.mjs');
 const window=text('packages/tower-game/window-prefab.mjs');
 const editor=text('src/features/masonry/architecture-assets.js');
 const engine=text('src/features/tower/prefab-scene.js');
 assert.match(door,/optimized\/door-7x9x2-stone-v1-meshopt\.glb/);
 assert.match(door,/optimized\/door-wood-v1-webp\.glb/);
 assert.match(window,/optimized\/window-wood-v3-webp\.glb/);
 assert.match(editor,/optimized\/door-7x9x2-stone-v1-meshopt\.glb/);
 assert.match(editor,/optimized\/window-wood-v3-webp\.glb/);
 assert.match(engine,/setMeshoptDecoder\(MeshoptDecoder\)/);
 assert.match(editor,/setMeshoptDecoder\(MeshoptDecoder\)/);
 assert.match(door,/DOOR_PREFAB_VERSION='17\.6-door\.1'/);
 assert.match(window,/WINDOW_PREFAB_VERSION='17\.6-window\.1'/);
});
test('the model sizes are measured, not estimated',()=>{
 const mesh=JSON.parse(text('reports/tower-model-size.json'));
 const wood=JSON.parse(text('reports/tower-wood-model-size.json'));
 assert.equal(mesh.models.find(x=>x.name==='door-7x9x2-stone-v1').status,'accepted');
 for(const n of ['window-wood-v3','door-wood-v1'])
  assert.equal(wood.models.find(x=>x.name===n).status,'accepted');
});

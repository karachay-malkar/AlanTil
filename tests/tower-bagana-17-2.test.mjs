import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../src/vendor/three/three.module.js';
import {GLTFLoader} from '../src/vendor/three/addons/loaders/GLTFLoader.js';
import {BUILDABLE_PREFAB_TYPES,prefabBounds,validatePrefabPlacement} from '../packages/tower-game/prefab-layout.mjs';
import {validateSectionJoints,resolvePrefabJoints} from '../packages/tower-game/prefab-joints.mjs';
import {BAGANA_PREFAB_ID,BAGANA_PREFAB_VERSION,BAGANA_PREFAB_FILE,BAGANA_PREFABS,BAGANA_PREFAB_VERSION_V2,baganaType,baganaPrefab,nextBaganaType} from '../packages/tower-game/bagana-prefab.mjs';
import {WINDOW_PREFAB_ID,WINDOW_PREFAB_VERSION} from '../packages/tower-game/window-prefab.mjs';

const entry=(id,sectionId,geometryVersion,x=0,y=0,z=0)=>({id,type:'masonry_section',sectionId,geometryVersion,variant:0,rotation:0,x,y,z});
const post=entry('bagana',BAGANA_PREFAB_ID,BAGANA_PREFAB_VERSION);
const windowSection=entry('window',WINDOW_PREFAB_ID,WINDOW_PREFAB_VERSION,2,0,0);
const manifest={version:'17.7-approved-manual.1'};
test('bagana is an approved single-variant 0.5×2.5×0.5m buildable item',()=>{
 assert.deepEqual(BUILDABLE_PREFAB_TYPES.find(spec=>spec.id===BAGANA_PREFAB_ID),{id:BAGANA_PREFAB_ID,size:[2,10,2]});
 assert.deepEqual(prefabBounds(post).size,[2,10,2]);
 assert.equal(validatePrefabPlacement([],post).ok,true);
 assert.equal(validatePrefabPlacement([post],entry('other',BAGANA_PREFAB_ID,BAGANA_PREFAB_VERSION)).ok,false);
});
test('wooden post can touch masonry without creating rubble or seam errors',()=>{
 const result=resolvePrefabJoints([post,windowSection],manifest);
 assert.equal(result.ok,true);
 assert.equal(result.joints.length,0);
 assert.equal(result.incompatible.length,0);
 assert.equal(validateSectionJoints([post],windowSection,manifest).ok,true);
});
test('approved bagana glb contains genuine 3D mesh geometry',()=>{
 const bytes=readFileSync(new URL('..'+BAGANA_PREFAB_FILE,import.meta.url));
 assert.equal(bytes.toString('ascii',0,4),'glTF');
 assert.equal(bytes.readUInt32LE(4),2);
 assert.equal(bytes.readUInt32LE(8),bytes.length);
 const size=bytes.readUInt32LE(12);
 const model=JSON.parse(bytes.subarray(20,20+size).toString('utf8').trim());
 assert.ok(model.meshes[0].primitives[0].attributes.POSITION!==undefined);
 assert.ok(model.accessors[0].count>100);
 assert.ok(model.materials[0].pbrMetallicRoughness.roughnessFactor>=.8);
});
test('catalog and server migration preserve IDs while adding Alan terminology',()=>{
 const client=readFileSync(new URL('../src/features/tower/index.js',import.meta.url),'utf8');
 const migration=readFileSync(new URL('../supabase/migrations/20261028123000_tower_bagana_172.sql',import.meta.url),'utf8');
 for(const name of ['Къабыргъа','Тешик толтуруу','Багъана','къабакъла','эшик','Терезе'])assert.ok(client.includes(name),name);
 assert.ok(client.includes("s.type===BAGANA_PREFAB_ID?BAGANA_PREFAB_VERSION"));
 assert.ok(migration.includes("WHEN typ='bagana-2x10x2'"));
 assert.ok(migration.includes("WHEN 'bagana-2x10x2' THEN ARRAY[2,10,2]"));
 for(const old of ['window-4x5x2','door-7x9x2','gate-18x10x2'])assert.ok(migration.includes(old));
});

test('bagana loads through the production Three.js GLTFLoader, with correct world bounds',async()=>{
 const bytes=readFileSync(new URL('..'+BAGANA_PREFAB_FILE,import.meta.url));
 const payload=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
 const result=await new Promise((resolve,reject)=>new GLTFLoader().parse(payload,'',resolve,reject));
 const box=new THREE.Box3().setFromObject(result.scene),size=box.getSize(new THREE.Vector3());
 assert.equal(result.scene.children.length>0,true);
 assert.ok(size.x>.3&&size.x<.5);
 assert.ok(Math.abs(size.y-2.5)<.01);
 assert.ok(size.z>.3&&size.z<.5);
 assert.ok(result.scene.getObjectByName('BAGANA_CARVED_WOOD_SUPPORT'));
});

test('tower and masonry release no longer share stale 17.2.35 cache keys',()=>{
 const release=JSON.parse(readFileSync(new URL('../release.json',import.meta.url)));
 const sw=readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');
 const router=readFileSync(new URL('../src/app/router.js',import.meta.url),'utf8');
 const scene=readFileSync(new URL('../src/features/tower/index.js',import.meta.url),'utf8');
 const masonry=readFileSync(new URL('../src/features/masonry/architecture-assets.js',import.meta.url),'utf8');
 assert.notEqual(release.version,'17.2.35');
 assert.ok(sw.includes('const VERSION = "'+release.version+'"'));
 assert.ok(router.includes('const TOWER_ASSET_VERSION = "'+release.version+'"'));
 assert.ok(router.includes('const MASONRY_ASSET_VERSION = "'+release.version+'"'));
 assert.ok(scene.includes('prefab-scene.js?v='+release.version));
 for(const name of ['къабакъла','эшик','Терезе']) assert.ok(masonry.includes(name),name);
});

test('15 bagana 3D assets: three forms and five 25cm increments with an integrated 25cm stone',async()=>{
 assert.equal(BAGANA_PREFABS.length,15);
 for(const spec of BAGANA_PREFABS){
  assert.deepEqual(prefabBounds(entry(spec.id,spec.id,BAGANA_PREFAB_VERSION_V2)).size,[3,spec.woodCells+1,3]);
  assert.equal(spec.stoneHeightM,.25);
  assert.equal(validatePrefabPlacement([],entry(spec.id,spec.id,BAGANA_PREFAB_VERSION_V2)).ok,true);
  const bytes=readFileSync(new URL('..'+spec.file,import.meta.url));
  const payload=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  const {scene}=await new Promise((resolve,reject)=>new GLTFLoader().parse(payload,'',resolve,reject));
  const wood=scene.getObjectByName('bagana_wood'),stone=scene.getObjectByName('bagana_stone');
  assert.ok(wood?.isMesh&&stone?.isMesh,'separate 3D material meshes');
  const stoneBounds=new THREE.Box3().setFromObject(stone),woodBounds=new THREE.Box3().setFromObject(wood),fullBounds=new THREE.Box3().setFromObject(scene);
  const penetration=stoneBounds.max.y-woodBounds.min.y;
  assert.ok(penetration>=-.005&&penetration<=.035,'wood must sit firmly in its original Common100 stone');
  assert.ok(Math.abs(stoneBounds.max.y-stoneBounds.min.y-.25)<.001);
  assert.ok(Math.abs(stoneBounds.min.y+spec.size[1]*.25/2)<.004,'stone base must rest on the footprint floor: '+spec.id);
  assert.ok(Math.abs(fullBounds.max.y-fullBounds.min.y-(spec.woodHeightM+.25))<.05);
  const extents=fullBounds.getSize(new THREE.Vector3());
  assert.ok(extents.x<=.75&&extents.z<=.75);
 }
});
test('bagana height selector and existing legacy post persist safely',()=>{
 const ui=readFileSync(new URL('../src/features/tower/index.js',import.meta.url),'utf8');
 assert.match(ui,/data-bagana-heights/);
 assert.match(ui,/data-bagana-wood-cells/);
 assert.match(ui,/baganaType\(current.form,cells\)/);
 assert.equal(baganaType(3,12),'bagana-f3-3x13x3');
 assert.equal(validatePrefabPlacement([],post).ok,true);
});


test('catalog shows only three bracketed sections and one bagana item',()=>{
 const ui=readFileSync(new URL('../src/features/tower/index.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/features/tower/tower.css',import.meta.url),'utf8');
 for(const name of ['Къабыргъа','Тешик толтуруу','Багъана']){
  assert.ok(ui.includes("label:'"+name+"'"));
 }
 assert.ok(ui.includes('class="bracketNavigation towerCatalogTab"'));
 assert.ok(ui.includes('data-catalog-category'));
 assert.ok(ui.includes('data-catalog-panel'));
 assert.ok(ui.includes('items:[baganaCatalogItem]'));
 assert.ok(ui.includes('baganaCatalogItem={id:baganaType(1,10)}'));
 assert.ok(!ui.includes('posts.map(catalogItem)'));
 assert.ok(!ui.includes("spec.id.replaceAll('x','×')||"));
 assert.ok(css.includes('.towerCatalogPanel{display:grid'));
});
test('existing type button cycles bagana form 1 -> 2 -> 3 -> 1 without resetting height',()=>{
 const ui=readFileSync(new URL('../src/features/tower/index.js',import.meta.url),'utf8');
 for(const height of [8,9,10,11,12]){
  let type=baganaType(1,height);
  for(const nextForm of [2,3,1]){
   type=nextBaganaType(type);
   assert.equal(type,baganaType(nextForm,height));
   assert.equal(baganaPrefab(type).woodCells,height);
  }
 }
 assert.equal(nextBaganaType('2x2x2'),null);
 assert.ok(ui.includes('s.type=nextBaganaType(s.type)'));
 assert.ok(ui.includes("variantButton.hidden=!post&&approvedVariantCount(s.type)<2"));
 assert.ok(ui.includes("s.variant=(s.variant+1)%count"));
 assert.ok(ui.includes("s.rotation=(s.rotation+1)%4"));
});

test('bagana geometry uses one closed wood surface and original Common 100 source stones',async()=>{
 const expected=['LARGE_005','LARGE_006','LARGE_009'];
 const source=JSON.parse(readFileSync(new URL('../assets/tower/approved-library/common100/common-100.json',import.meta.url),'utf8'));
 for(const spec of BAGANA_PREFABS){
  const bytes=readFileSync(new URL('..'+spec.file,import.meta.url));
  const textLength=bytes.readUInt32LE(12);
  const gltf=JSON.parse(bytes.subarray(20,20+textLength).toString('utf8').trim());
  const original=expected[spec.form-1];
  assert.ok(gltf.asset.generator.includes('Common100 '+original));
  assert.equal(gltf.meshes.length,2);
  const originalStone=source.models.find(m=>m.name===original);
  const stonePrim=gltf.meshes[1].primitives[0];
  assert.equal(gltf.accessors[stonePrim.indices].count,originalStone.triangles*3);
  const woodPrim=gltf.meshes[0].primitives[0];
  const index=gltf.accessors[woodPrim.indices],view=gltf.bufferViews[index.bufferView];
  const offset=20+textLength+8+view.byteOffset;
  const read=i=>index.componentType===5125?bytes.readUInt32LE(offset+i*4):bytes.readUInt16LE(offset+i*2);
  const edgeCounts=new Map(),parent=new Int32Array(gltf.accessors[woodPrim.attributes.POSITION].count);
  for(let i=0;i<parent.length;i++)parent[i]=i;
  const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  for(let i=0;i<index.count;i+=3){
   const a=read(i),b=read(i+1),c=read(i+2);
   parent[find(b)]=find(a);parent[find(c)]=find(a);
   for(const [x,y] of [[a,b],[b,c],[c,a]]){const k=x<y?x+'_'+y:y+'_'+x;edgeCounts.set(k,(edgeCounts.get(k)||0)+1);}
  }
  assert.ok([...edgeCounts.values()].every(v=>v===2),'wood is watertight with no exposed internal endcaps');
  const groups=new Set(Array.from({length:parent.length},(_,i)=>find(i)));
  assert.equal(groups.size,1,'wood must be one connected seamless surface');
 }
});
test('catalog header is removed and hammer is a dedicated construction icon',()=>{
 const ui=readFileSync(new URL('../src/features/tower/index.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/features/tower/tower.css',import.meta.url),'utf8');
 const icons=readFileSync(new URL('../src/shared/ui/icons.js',import.meta.url),'utf8');
 assert.ok(!ui.includes('towerCatalogHeading'));
 assert.ok(ui.includes("hammer:'hammer'"));
 assert.ok(icons.includes('hammer:'));
 assert.ok(css.includes('.towerCatalogClose{position:absolute'));
});

test('timber supports use three distinct construction tops at every wood height',async()=>{
 const forms=new Map();
 for(const spec of BAGANA_PREFABS){
  const bytes=readFileSync(new URL('..'+spec.file,import.meta.url));
  const payload=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length);
  const result=await new Promise((resolve,reject)=>new GLTFLoader().parse(payload,'',resolve,reject));
  const wood=result.scene.getObjectByName('bagana_wood');
  assert.ok(wood?.isMesh);
  const p=wood.geometry.getAttribute('position');
  let top=-Infinity,centreTop=-Infinity;
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
   top=Math.max(top,y);
   if(Math.hypot(x,z)<.035&&y>0)centreTop=Math.max(centreTop,y);
  }
  const depression=top-centreTop;
  if(spec.form===2)assert.ok(depression>=-.005&&depression<.012,
   'flat chamfered top must have no fork or deep notch: '+spec.id+' '+depression);
  if(spec.form===3)assert.ok(depression>.040&&depression<.10,
   'shallow saddle must have a smooth 4–10cm depression: '+spec.id+' '+depression);
  forms.set(spec.form,(forms.get(spec.form)||0)+1);
 }
 assert.deepEqual([...forms.values()],[5,5,5]);
});

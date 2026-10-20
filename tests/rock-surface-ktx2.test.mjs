import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const read=(p)=>readFileSync(resolve(root,p),'utf8');
const stoneRoot='assets/tower/materials/balkaria-stone-v2.1';
const maps=['BaseColor','Normal_OpenGL','ORM','DetailNormal_OpenGL'];

test('KTX2 files are genuine Basis Universal 2K with mipmaps',()=>{
 for(const name of maps){
  const file=resolve(root,stoneRoot,`BalkariaStone_${name}_2K.ktx2`);
  assert.ok(existsSync(file),`missing KTX2: ${file}`);
  const bytes=readFileSync(file);
  assert.equal(bytes.subarray(0,12).toString('hex'),'ab4b5458203230bb0d0a1a0a');
  assert.equal(bytes.readUInt32LE(20),2048);
  assert.equal(bytes.readUInt32LE(24),2048);
  assert.ok(bytes.readUInt32LE(40)>1,'mip levels');
  assert.ok([1,2].includes(bytes.readUInt32LE(44)),'Basis/UASTC container supercompression');
  assert.ok(statSync(file).size>100_000,'nonempty compressed payload');
 }
});

test('self-hosted Three.js KTX2 loader and Basis transcoder are installed',()=>{
 for(const path of ['src/vendor/three/addons/loaders/KTX2Loader.js','src/vendor/three/addons/utils/WorkerPool.js','src/vendor/three/addons/libs/basis/basis_transcoder.js','src/vendor/three/addons/libs/basis/basis_transcoder.wasm']){
  assert.ok(existsSync(resolve(root,path)),path);
 }
});

test('shared stone material prefers KTX2 and retains PNG fallback with correct PBR channels',()=>{
 const rock=read('src/features/tower/rock-surface.js');
 assert.match(rock,/KTX2Loader/);
 assert.match(rock,/detectSupport\(renderer\)/);
 assert.match(rock,/BalkariaStone_/);
 for(const name of ['BaseColor','Normal_OpenGL','ORM'])assert.ok(rock.includes("'"+name+"'"),name);
 assert.match(rock,/url\(name,'ktx2'\)/);
 assert.match(rock,/url\(name,'png'\)/);
 assert.match(rock,/roughnessMap\s*:/);
 assert.match(rock,/metalness:0/);
 assert.doesNotMatch(rock,/\baoMap\s*:/);
 assert.match(rock,/SRGBColorSpace/);
 assert.match(rock,/setAttribute\('uv2'/);
 assert.match(rock,/alantilNonStone/);
 assert.match(rock,/WeakMap/);
});

test('scene provides renderer to material loader; gate PBR and saved identity remain intact',()=>{
 const scene=read('src/features/tower/prefab-scene.js');
 const gate=read('src/features/tower/gate-surface.js');
 assert.match(scene,/getRockSurface\(renderer\)/);
 assert.match(scene,/applyRockSurface\(masonry,stoneMaterial\)/);
 assert.match(scene,/applyGateSurfaces\(gate,door\.scene,stoneMaterial\)/);
 assert.match(gate,/ALANTIL_GATE_WOOD_FROM_DOOR_PBR/);
 assert.match(gate,/ALANTIL_GATE_IRON_FROM_DOOR_PBR/);
});

test('Light Ochre texture version is reachable through every lazy import and cache key',()=>{
 const router=read('src/app/router.js');
 const feature=read('src/features/tower/index.js');
 const scene=read('src/features/tower/prefab-scene.js');
 const rock=read('src/features/tower/rock-surface.js');
 assert.ok(router.includes('const TOWER_ASSET_VERSION = "17.5.8-gate-editor-stretch.v8.1";'));
 assert.ok(feature.includes("prefab-scene.js?v=gate-editor-stretch-v8.1"));
 assert.ok(scene.includes("rock-surface.js?v=balkaria-stone-v2.1-light-ochre.1"));
 assert.ok(rock.includes("export const ROCK_SURFACE_VERSION='balkaria-stone-v2.1-light-ochre.1';"));
 assert.ok(rock.includes("const url=(name,extension)=>root+'BalkariaStone_'+name+'_2K.'+extension+'?v='+ROCK_SURFACE_VERSION"));
});

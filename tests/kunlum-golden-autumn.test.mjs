import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../src/vendor/three/three.module.js';
import {KUNLUM_AUTUMN,KUNLUM_AUTUMN_TERRAIN,createKunlumAutumnSky}
 from '../src/features/tower/kunlum-autumn-palette.js';
import {createKunlumTerrainTiles} from '../src/features/tower/kunlum-game-landscape.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('four coherent autumn terrain materials keep generated PBR textures',()=>{
 assert.equal(Object.keys(KUNLUM_AUTUMN_TERRAIN).length,4);
 const textures=createKunlumTerrainTiles(THREE,{resolution:32});
 for(const name of ['grass','soil','scree','rock']){
  const texture=textures[name];
  assert.equal(texture.image.width,32);
  assert.equal(texture.image.data.length,32*32*4);
  const bounds=KUNLUM_AUTUMN_TERRAIN[name];
  for(const component of [...bounds.lo,...bounds.hi])assert.ok(component>=0&&component<=255);
  texture.dispose();
 }
 assert.equal(KUNLUM_AUTUMN.dryGrass,'#B89C5E');
 assert.equal(KUNLUM_AUTUMN.skyTop,'#96B4C3');
 assert.equal(KUNLUM_AUTUMN.skyHorizon,'#C7D2D7');
});
test('sky gradient tracks first-person camera without extra texture loads',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
 camera.position.set(8,12,21);
 const sky=createKunlumAutumnSky(THREE,scene,camera);
 assert.ok(sky.mesh.isMesh);
 assert.equal(sky.mesh.position.distanceTo(camera.position),0);
 assert.equal(sky.mesh.material.depthWrite,false);
 assert.equal(sky.mesh.material.fog,false);
 assert.equal(sky.mesh.geometry.getAttribute('color').count,sky.mesh.geometry.getAttribute('position').count);
 camera.position.set(33,14,40);sky.update();
 assert.equal(sky.mesh.position.distanceTo(camera.position),0);
 sky.dispose();
 assert.equal(scene.children.includes(sky.mesh),false);
});
test('game lighting, fog and panorama use the same autumn palette',()=>{
 const scene=read('src/features/tower/prefab-scene.js');
 const landscape=read('src/features/tower/kunlum-game-landscape.js');
 const terrain=read('src/features/tower/kunlum-terrain-lod.js');
 const scatter=read('src/features/tower/kunlum-terrain-scatter.js');
 assert.match(scene,/createKunlumAutumnSky\(THREE,scene,camera\)/);
 assert.match(scene,/sky\.update\(\);renderer\.render\(scene,camera\)/);
 assert.match(scene,/scene\.fog=new THREE\.Fog\(KUNLUM_AUTUMN\.fog/);
 assert.match(landscape,/const palettes=KUNLUM_AUTUMN_TERRAIN/);
 assert.match(terrain,/grad\.addColorStop\(0,KUNLUM_AUTUMN\.skyTop\)/);
 assert.match(scatter,/KUNLUM_AUTUMN\.dryGrass/);
 assert.doesNotMatch(scene,/#b3c9d9/i);
});

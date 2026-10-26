import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_KUNLUM_ALIGNMENT,pixelToLocalWorld,plotCorners,rotateKunlumPlanPoint} from '../src/features/tower/kunlum-georeference.js';
import {createKunlumGameAlignment} from '../src/features/tower/kunlum-build-alignment.js';
import {readFileSync} from 'node:fs';
import {wideDemTilePlan} from '../src/features/tower/kunlum-wide-dem.js';

const plan=JSON.parse(readFileSync(new URL('../assets/tower/environment/kunlum-vector-plan-2026-10-23.json',import.meta.url),'utf8'));
const a=createKunlumGameAlignment({plot:plan.plot});
const near=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1])<1e-7;
test('single 15x30m yellow parcel anchors the build grid',()=>{
 const projected=plotCorners(plan.plot,plan.plot.ppm).map(x=>a.planToScene(x));
 const centroid=[projected.reduce((n,x)=>n+x[0],0)/4,projected.reduce((n,x)=>n+x[1],0)/4];
 assert.ok(near(centroid,[7.5,15]),'the authoritative rectangle must be centred on game plot');
 const lengths=projected.map((p,i)=>Math.hypot(p[0]-projected[(i+1)%4][0],p[1]-projected[(i+1)%4][1]));
 assert.ok(lengths.every((l,i)=>Math.abs(l-(i%2?15:30))<1e-8));
 assert.notDeepEqual(a.planToScene([DEFAULT_KUNLUM_ALIGNMENT.anchorPixel.x,DEFAULT_KUNLUM_ALIGNMENT.anchorPixel.y]),[7.5,15],
  'Abay-Kala anchor cannot be arbitrarily placed on building site');
});
test('all terrain and OSM locations use the same reversible mirrored display frame',()=>{
 const pts=[[0,0],[100,-150],[-1780,1730],[1800,1800]];
 for(const [east,north] of pts){
  const scene=a.demToScene(east,north);
  const source=a.sceneToDem(...scene);
  assert.ok(near(source,[east,north]));
 }
 const pt=[994,688];
 const projected=rotateKunlumPlanPoint(pixelToLocalWorld(pt,{...DEFAULT_KUNLUM_ALIGNMENT,pixelsPerMetre:plan.plot.ppm}),a.rotation);
 assert.ok(near(a.planToScene(pt),[7.5+projected[0]-a.origin[0],15+projected[1]-a.origin[1]]));
 assert.ok(near(a.sceneToDem(7.5,15),[-a.origin[0],a.origin[1]]));
});
test('single mapped 15x30 footprint matches game placement',()=>{
 assert.deepEqual(a.footprintMetres,[15,30]);
 const xs=a.footprintScene.map(p=>p[0]),zs=a.footprintScene.map(p=>p[1]);
 for(const [value,want] of [[Math.min(...xs),0],[Math.max(...xs),15],[Math.min(...zs),0],[Math.max(...zs),30]])
  assert.ok(Math.abs(value-want)<1e-7);
});
test('game environment requests real Mapzen outer data and retains immutable Copernicus core',()=>{
 const src=readFileSync(new URL('../src/features/tower/kunlum-real-environment.js',import.meta.url),'utf8');
 const terrain=readFileSync(new URL('../src/features/tower/kunlum-terrain-lod.js',import.meta.url),'utf8');
 assert.match(src,/createKunlumWideDem/);
 assert.match(src,/terrain\.installWideDem\(/);
 assert.match(src,/sourceAccuracy:'Approved user-drawn vector plan/);
 assert.match(terrain,/installWideDem/);
 assert.match(readFileSync(new URL('../src/features/tower/kunlum-wide-dem.js',import.meta.url),'utf8'),/originalSample/);
 assert.match(src,/loadKunlumCherekLocal/);
 assert.doesNotMatch(src,/excludeBounds:/);
});
test('all nine AWS Mapzen originals are locally pinned with unchanged PNG pixel encoding',()=>{
 const path='assets/tower/environment/mapzen-terrarium-z13/';
 const manifest=JSON.parse(readFileSync(new URL('../'+path+'manifest.json',import.meta.url),'utf8'));
 const p=wideDemTilePlan();
 assert.deepEqual(manifest.grid,[p.x0,p.x1,p.y0,p.y1]);
 assert.equal(manifest.tiles.length,p.tiles);
 assert.equal(manifest.tiles.length,9);
 for(const filename of manifest.tiles){
  const png=readFileSync(new URL('../'+path+filename,import.meta.url));
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16),256);
  assert.equal(png.readUInt32BE(20),256);
 }
 const source=readFileSync(new URL('../src/features/tower/kunlum-wide-dem.js',import.meta.url),'utf8');
 assert.match(source,/\/assets\/tower\/environment\/mapzen-terrarium-z13\//);
});

test('outer DEM is deferred until panorama; first-person loads only the local terrain',()=>{
 const env=readFileSync(new URL('../src/features/tower/kunlum-real-environment.js',import.meta.url),'utf8');
 const scene=readFileSync(new URL('../src/features/tower/prefab-scene.js',import.meta.url),'utf8');
 assert.match(env,/function ensureWideTerrain\(\)/);
 assert.doesNotMatch(env,/void loadWideTerrain\(\);/);
 assert.match(env,/ensureWideTerrain,/);
 assert.match(scene,/if\(worldMode\)void kunlum\.ensureWideTerrain\(\)/);
 assert.match(scene,/void kunlum\?\.ensureWideTerrain\?\.\(\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_KUNLUM_ALIGNMENT,pixelToLocalWorld,plotCorners,rotateKunlumPlanPoint} from '../src/features/tower/kunlum-georeference.js';
import {PLOT,createKunlumGameAlignment} from '../src/features/tower/kunlum-build-alignment.js';
import {readFileSync} from 'node:fs';

const a=createKunlumGameAlignment();
const near=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1])<1e-7;
test('yellow 30x15m rectangle, not unrotated DEM, anchors the legacy 20m game scene',()=>{
 const projected=plotCorners(PLOT,DEFAULT_KUNLUM_ALIGNMENT.pixelsPerMetre).map(x=>a.planToScene(x));
 const centroid=[projected.reduce((n,x)=>n+x[0],0)/4,projected.reduce((n,x)=>n+x[1],0)/4];
 assert.ok(near(centroid,[10,10]),'the authoritative rectangle must be centred on game plot');
 const lengths=projected.map((p,i)=>Math.hypot(p[0]-projected[(i+1)%4][0],p[1]-projected[(i+1)%4][1]));
 assert.ok(lengths.every((l,i)=>Math.abs(l-(i%2?15:30))<1e-8));
 assert.notDeepEqual(a.planToScene([DEFAULT_KUNLUM_ALIGNMENT.anchorPixel.x,DEFAULT_KUNLUM_ALIGNMENT.anchorPixel.y]),[10,10],
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
 const plan=rotateKunlumPlanPoint(pixelToLocalWorld(pt),-134);
 assert.ok(near(a.planToScene(pt),[10+plan[0]-a.origin[0],10+plan[1]-a.origin[1]]));
 assert.ok(near(a.sceneToDem(10,10),[-a.origin[0],a.origin[1]]));
});
test('mapped 30x15 footprint cannot silently be treated as the saved 20x20 placement area',()=>{
 assert.equal(a.footprintMetres[0],30);
 assert.equal(a.footprintMetres[1],15);
 assert.deepEqual(a.savedBuildableMetres,[20,20]);
 assert.equal(a.legacyBuildFitsYellow,false);
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
 assert.match(src,/excludeBounds/);
});
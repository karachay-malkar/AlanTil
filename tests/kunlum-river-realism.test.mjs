import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../src/vendor/three/three.module.js';
import {
 loadKunlumCherekLocal,riverDistanceAt,carveKunlumRiverHeight,
 createKunlumRiverLayer
} from '../src/features/tower/kunlum-river-layer.js';
import {createKunlumRiverbankScatter} from '../src/features/tower/kunlum-terrain-scatter.js';

const snapshot=JSON.parse(readFileSync(new URL('../assets/tower/environment/kunlum-cherek-balkarsky-osm.json',import.meta.url)));
const line=[{x:0,z:0},{x:45,z:30},{x:70,z:85}];
const elevation=(x,z)=>150+x*.01-z*.18;

test('checked OSM centreline is stored locally, without requiring a live request',async()=>{
 assert.equal(snapshot.license,'ODbL');
 assert.equal(snapshot.projection,'UTM38 local metres relative to tower control');
 assert.ok(snapshot.points.length>100);
 const result=await loadKunlumCherekLocal({fetchImpl:async url=>{
  assert.match(url,/kunlum-cherek-balkarsky-osm\.json/);
  return {ok:true,json:async()=>snapshot};
 }});
 assert.equal(result.line.length,snapshot.points.length);
 assert.equal(result.source,'local OpenStreetMap ODbL snapshot');
});

test('local centreline rejects unverified, disconnected or malformed coordinates',async()=>{
 const response=data=>()=>Promise.resolve({ok:true,json:async()=>data});
 await assert.rejects(()=>loadKunlumCherekLocal({fetchImpl:response({...snapshot,license:'unknown'})}),/ODbL|лиценз/i);
 await assert.rejects(()=>loadKunlumCherekLocal({fetchImpl:response({...snapshot,points:[[0,0],[500,500]]})}),/линия|русла|точек|разрыв/i);
 await assert.rejects(()=>loadKunlumCherekLocal({fetchImpl:response({...snapshot,points:[[NaN,0],[0,1]]})}),/линия|русла|точек|координат/i);
});

test('the river channel is a render-only cut and leaves the source DEM sampler intact',()=>{
 const flat=()=>150;
 assert.equal(riverDistanceAt(line,10,7)<10,true);
 assert.equal(riverDistanceAt(line,200,100)>60,true);
 const center=carveKunlumRiverHeight(15,10,flat,line);
 assert.ok(center<148.5,'real trough at water centre');
 assert.equal(carveKunlumRiverHeight(200,100,flat,line),150);
 assert.equal(flat(15,10),150,'underlying DEM remains exactly the same');
});

test('3D bed, slopes, shore and water use finite indexed geometry at desktop and mobile quality',()=>{
 const desktop=createKunlumRiverLayer(THREE,elevation,{centerline:line,quality:'beautiful',mobile:false});
 const mobile=createKunlumRiverLayer(THREE,elevation,{centerline:line,quality:'interactive',mobile:true});
 for(const scene of [desktop,mobile]){
  assert.ok(scene.stats.waterTriangles>0);
  assert.ok(scene.stats.bedTriangles>0);
  assert.ok(scene.stats.slopeTriangles>0);
  assert.ok(scene.stats.shoreTriangles>0);
  assert.ok(scene.root.getObjectByName('Cherek flowing water'));
  for(const o of scene.root.children)if(o.isMesh){
   assert.ok(o.geometry.index.count>0,o.name);
   assert.ok([...o.geometry.getAttribute('position').array].every(Number.isFinite),o.name);
  }
  scene.update(12);
  scene.dispose();
 }
 assert.ok(mobile.stats.waterTriangles<desktop.stats.waterTriangles);
});

test('stone shores use bounded instancing on mobile and desktop',()=>{
 const ds=createKunlumRiverbankScatter(THREE,elevation,{points:line,mobile:false});
 const ms=createKunlumRiverbankScatter(THREE,elevation,{points:line,mobile:true});
 assert.ok(ds.root.children.length>=2);
 assert.ok(ms.counts.pebble<=ds.counts.pebble);
 assert.ok(ms.counts.boulder<=ds.counts.boulder);
 assert.ok(ms.counts.shrub<=ds.counts.shrub);
 for(const group of [ds,ms]){for(const m of group.root.children)assert.ok(m.isInstancedMesh);group.dispose()}
});

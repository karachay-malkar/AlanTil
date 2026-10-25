import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const geoCode=await read('src/features/tower/kunlum-georeference.js');
const demCode=await read('src/features/tower/kunlum-dem-data.js');
const terrainCode=await read('src/features/tower/kunlum-terrain-lod.js');
const settlementCode=await read('src/features/tower/kunlum-vector-settlement.js');
const gameplayCode=await read('src/features/tower/kunlum-real-environment.js');
const sceneCode=await read('src/features/tower/prefab-scene.js');
const map=JSON.parse(await read('assets/tower/environment/kunlum-vector-confirmed.json'));
const guesses=JSON.parse(await read('assets/tower/environment/kunlum-vector-candidates.json'));
const cal=JSON.parse(await read('assets/tower/environment/kunlum-georef-user-calibration.json'));
const m=geoCode.replace(/^export /gm,'');
const transform=new Function(m+';return {pixelToLocalWorld,localWorldToPixel,plotCorners,sampleDemLocal,DEFAULT_KUNLUM_ALIGNMENT}')();
const encoded=demCode.match(/heightsBase64:"([^"]+)"/)?.[1];
const bytes=encoded&&Buffer.from(encoded,'base64');
function decode(){
 const out=new Float32Array(121*121);
 for(let i=0;i<out.length;i++)out[i]=bytes.readInt16LE(2*i)/10;
 return out;
}

test('real Copernicus grid is present, complete and centred at Abaev Kala',()=>{
 assert.ok(bytes);
 assert.equal(bytes.length,121*121*2);
 const h=decode();
 assert.equal(h[60*121+60],0);
 assert.ok(h.every(Number.isFinite));
 const min=Math.min(...h),max=Math.max(...h);
 assert.ok(min<-100 && max>900,'Expected steep Cherek valley relief');
});

test('user-supplied georegistration round-trips, mirroring only walls',()=>{
 const user=transform.DEFAULT_KUNLUM_ALIGNMENT;
 assert.deepEqual(user.anchorPixel,cal.anchorPixel);
 assert.equal(user.pixelsPerMetre,cal.pixelsPerMetre);
 assert.equal(user.angleDeg,cal.angleDeg);
 assert.equal(user.mirrorWallsX,true);
 assert.equal(cal.controlPointsVerified,0);
 const sample=[1076.2,786.4],location=transform.pixelToLocalWorld(sample,user);
 const inverse=transform.localWorldToPixel(location,user);
 assert.ok(Math.hypot(inverse[0]-sample[0],inverse[1]-sample[1])<1e-8);
 const other=transform.pixelToLocalWorld(sample,{...user,mirrorWallsX:false});
 assert.notDeepEqual(location,other);
});

test('construction zone keeps actual 30x15m physical dimensions',()=>{
 const corners=transform.plotCorners(map.plot,cal.pixelsPerMetre).map(p=>transform.pixelToLocalWorld(p,cal));
 const lengths=corners.map((p,i)=>{
  const b=corners[(i+1)%4];return Math.hypot(b[0]-p[0],b[1]-p[1]);
 });
 for(let i=0;i<4;i++)assert.ok(Math.abs(lengths[i]-(i%2?15:30))<1e-7);
});

test('all source wall contours are retained without 37 promoted duplicates',()=>{
 assert.equal(map.confirmed_features.length,69);
 assert.equal(map.confirmed_features.filter(x=>x.type==='passage').length,16);
 assert.equal(guesses.auto_candidates.length,702);
 assert.equal(guesses.auto_candidates.filter(x=>x.promoted).length,37);
 assert.equal(guesses.auto_candidates.filter(x=>!x.promoted).length,665);
 assert.equal(map.confirmed_features.reduce((sum,x)=>sum+x.points.length,0),234);
 assert.match(settlementCode,/outsideParts\(a,b\)/);
 assert.match(settlementCode,/f\.promoted\|\|origins\.has\(f\.id\)/);
});

test('terrain is built as metre-scaled LOD tiles with procedural non-Google panorama',()=>{
 assert.match(terrainCode,/makeKunlumTerrain/);
 assert.match(terrainCode,/makeKunlumPanorama/);
 assert.match(terrainCode,/addTerrainTile/);
 assert.match(terrainCode,/near=mobile\?450:600/);
 assert.match(terrainCode,/canvas\.width=mobile\?1024:2048/);
 assert.match(terrainCode,/sampleDemLocal/);
 assert.doesNotMatch(terrainCode,/earth\.google|maps\.google|googleapis\.com/i);
});

test('tower interaction, state and raycast path remain untouched',()=>{
 assert.match(sceneCode,/createKunlumRealEnvironment as createKunlumEnvironment/);
 assert.match(sceneCode,/onReady:refreshEnvironmentStatus/);
 assert.match(sceneCode,/raycaster\.intersectObjects\(\[\.\.\.targets,floor\],false\)/);
 assert.match(sceneCode,/maxDistance=85/);
 assert.match(gameplayCode,/return \{group,heightAt:terrain\.heightAt,ready,update\(seconds\)/);
 assert.match(gameplayCode,/accuracy:'UNVERIFIED/);
});

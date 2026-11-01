import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {KUNLUM_BUILD_PARCEL,TOWER_ORBIT_CONTEXT_METERS,TOWER_ORBIT_REGION,
 towerOrbitFramingDistance,towerOrbitMaximumDistance,towerOrbitTargetY} from '../packages/tower-game/kunlum-parcel.mjs';
import {checkRoofPlacement} from '../packages/tower-game/roof-cover.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('building camera includes precisely ten metres around all parcel edges',()=>{
 assert.equal(KUNLUM_BUILD_PARCEL.widthM,15);
 assert.equal(KUNLUM_BUILD_PARCEL.depthM,30);
 assert.equal(TOWER_ORBIT_CONTEXT_METERS,10);
 assert.deepEqual(TOWER_ORBIT_REGION,{minX:-10,maxX:25,minZ:-10,maxZ:40,widthM:35,depthM:50});
 assert.ok(towerOrbitMaximumDistance(1)>towerOrbitFramingDistance(1));
 assert.ok(towerOrbitFramingDistance(.5)>towerOrbitFramingDistance(1));
});
test('orbit target follows growing tower height with a safe upper bound',()=>{
 assert.ok(towerOrbitTargetY([{y:36}])>towerOrbitTargetY([]));
 assert.ok(towerOrbitTargetY([{y:200}])<=12);
});
test('one-cell roof on bare ground is valid, elevated one needs supports',()=>{
 assert.equal(checkRoofPlacement([[2,3]],0,[]).ok,true);
 assert.equal(checkRoofPlacement([[2,3]],1,[]).reason,'ROOF_SUPPORT_REQUIRED');
 assert.equal(checkRoofPlacement([[2,3]],-1,[]).ok,false);
});
test('ground roof still collides with masonry on the same cells',()=>{
 const block={type:'masonry_section',_roofBounds:{min:[2,0,3],max:[3,1,4]}};
 assert.equal(checkRoofPlacement([[2,3]],0,[block]).reason,'ROOF_COLLISION');
});
test('new construction controls use orbit rather than joystick',()=>{
 const scene=read('src/features/tower/prefab-scene.js');
 const ui=read('src/features/tower/index.js');
 assert.match(scene,/function setConstructionOrbit\(/);
 assert.match(scene,/towerOrbitMaximumDistance/);
 assert.match(scene,/controls\.enablePan=true/);
 assert.match(scene,/THREE\.TOUCH\.DOLLY_PAN/);
 assert.match(scene,/Math\.pow\(zoom,\.75\)/);
 assert.match(scene,/cameraMode='orbit'/);
 assert.match(ui,/data-home/);
 assert.doesNotMatch(ui,/data-joystick|data-rise|data-fall|function stickMove/);
 assert.match(ui,/Неверный контур крыши/);
});

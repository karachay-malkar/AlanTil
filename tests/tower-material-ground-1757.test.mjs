import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('rock surface preserves albedo and normal without unverified ambient occlusion',()=>{
 const s=src('src/features/tower/rock-surface.js');
 assert.match(s,/map,normalMap/);
 assert.match(s,/roughnessMap:orm/);
 assert.doesNotMatch(s,/\baoMap:orm\b/);
 assert.match(s,/metalness:0/);
});
test('door stone and timber retain the same -12.5 cm local offset',()=>{
 const s=src('src/features/tower/prefab-scene.js');
 assert.match(s,/masonry\.position\.y=-\.125/);
 assert.match(s,/carpentry\.position\.y=-\.125/);
 assert.doesNotMatch(s,/assembled\.position\.y=-\.125/);
});
test('gate is seated against its actual authored geometry bottom',()=>{
 const s=src('src/features/tower/prefab-scene.js');
 assert.match(s,/const bounds=new THREE\.Box3\(\)\.setFromObject\(gate\)/);
 assert.match(s,/gate\.position\.y\+=targetBottom-bounds\.min\.y/);
 assert.match(s,/const group=new THREE\.Group\(\);group\.add\(model\.clone\(true\)\)/);
});

test('compact stone geometry is textured before instancing',()=>{
 const scene=src('src/features/tower/prefab-scene.js');
 const compact=src('src/features/tower/compact-stone-scene.js');
 assert.match(scene,/applyRockSurface\(source\.scene\.clone\(true\),stoneMaterial\)/);
 assert.match(scene,/assembleCompactStoneSection\(texturedSource,layouts/);
 assert.match(compact,/geometry\.getAttribute\('uv'\)/);
 assert.match(compact,/geometry\.getAttribute\('normal'\)/);
});

test('mobile texture comparison can force PNG without altering saved sections',()=>{
 const surface=src('src/features/tower/rock-surface.js');
 assert.match(surface,/towerTexture/);
 assert.match(surface,/get\('towerTexture'\)===\x27png\x27/);
 assert.match(surface,/encoding:\x27PNG\x27/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/features/tower/kunlum-stone-facing.js',import.meta.url),'utf8');

test('every camera distance uses the same Common100 model selection and stone layers',()=>{
 assert.match(source,/const count=mobile\?12:24;/);
 assert.match(source,/for\(const layerDepth of \(mobile\?\[-1,1\]:\[-1,0,1\]\)\)/);
 assert.match(source,/new THREE\.InstancedMesh\(models\[k\]\.geometry,material,bins\[k\]\.length\)/);
 assert.match(source,/mesh\.computeBoundingSphere\(\)/);
 assert.match(source,/mesh\.frustumCulled=true/);
 assert.doesNotMatch(source,/midModels|makeKunlumRuinShell|bucket\.far|bucket\.medium|bucket\.near/);
});

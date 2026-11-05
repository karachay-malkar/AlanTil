import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/features/tower/kunlum-stone-facing.js',import.meta.url),'utf8');

test('middle-distance Common100 uses one double-sided stone layer, preserving real geometry without duplicate depth',()=>{
 assert.match(source,/const count=mobile\?12:24;/);
 assert.match(source,/const midModels=models\.filter\(\(_,i\)=>i%3===0\);/);
 assert.match(source,/for\(const layerDepth of \(near\?\[-1,0,1\]:\[0\]\)\)/);
 assert.match(source,/new THREE\.InstancedMesh\(geometryList\[k\],groupMaterial,bins\[k\]\.length\)/);
 assert.match(source,/const m=sources\[k\]/);
});

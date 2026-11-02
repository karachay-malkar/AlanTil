import test from 'node:test';
import assert from 'node:assert/strict';
import {installKunlumCliffTriplanar} from '../src/features/tower/kunlum-cliff-projection.mjs';
test('steep slopes use triplanar rock grain without changing the PBR shading model',()=>{
 const material={};
 installKunlumCliffTriplanar(material,{textureScale:.27});
 const shader={
  vertexShader:'#include <common>\n#include <begin_vertex>\n',
  fragmentShader:'#include <common>\n#include <map_fragment>\n'
 };
 material.onBeforeCompile(shader);
 assert.match(shader.vertexShader,/varying vec3 vKunlumCliffPosition/);
 assert.match(shader.fragmentShader,/vKunlumCliffPosition\.yz/);
 assert.match(shader.fragmentShader,/vKunlumCliffPosition\.xz/);
 assert.match(shader.fragmentShader,/vKunlumCliffPosition\.xy/);
 assert.match(shader.fragmentShader,/smoothstep\(90\.0,210\.0/);
 assert.match(shader.fragmentShader,/#ifdef USE_MAP/);
 assert.match(shader.fragmentShader,/diffuseColor \*= sampledDiffuseColor/);
 assert.equal(typeof material.customProgramCacheKey,'function');
});
test('distance optimization preserves standard shader chunks on incompatible material',()=>{
 const material={onBeforeCompile(shader){shader.fragmentShader+='\nPREVIOUS';}};
 installKunlumCliffTriplanar(material);
 const shader={vertexShader:'custom',fragmentShader:'custom'};
 material.onBeforeCompile(shader);
 assert.equal(shader.fragmentShader,'custom\nPREVIOUS');
});

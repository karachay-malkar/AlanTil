/** Regression for the 3D editor crash reported on Android Chromium.
 * Run with: node --test scripts/qa/masonry-dashed-lines.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../../src/vendor/three/three.module.js';

test('Three.js dashed outline computes line distances on LineSegments, not geometry',()=>{
 const ghost=new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1,1,1)),
  new THREE.LineDashedMaterial({color:'#358c72',dashSize:.055,gapSize:.028})
 );
 assert.equal(typeof ghost.computeLineDistances,'function');
 assert.equal(typeof ghost.geometry.computeLineDistances,'undefined');
 ghost.computeLineDistances();
 assert.ok(ghost.geometry.getAttribute('lineDistance'));
 assert.equal(ghost.geometry.getAttribute('lineDistance').count,ghost.geometry.getAttribute('position').count);
 ghost.geometry.dispose();ghost.material.dispose();
});
test('Manual editor calls the LineSegments method',()=>{
 const text=readFileSync(new URL('../../src/features/masonry/scene.js',import.meta.url),'utf8');
 assert.match(text,/ghost\.computeLineDistances\(\)/);
 assert.doesNotMatch(text,/ghost\.geometry\.computeLineDistances\(\)/);
});

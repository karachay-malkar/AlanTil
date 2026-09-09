import test from 'node:test';
import assert from 'node:assert/strict';
import {topographyLayers} from '../../packages/alantil-ui/topography.js';
for(const size of [420,460])test(`topographic ellipse reaches farthest tile corner at ${size}`,()=>{
 for(const layer of topographyLayers(size)){
  const farX=Math.max(layer.cx,size-layer.cx),farY=Math.max(layer.cy,size-layer.cy);
  assert.ok(Math.abs((farX/layer.rx)**2+(farY/layer.ry)**2-1)<1e-12);
  assert.ok(layer.stops.every(([offset])=>offset>=0&&offset<=1));
  assert.ok(layer.stops.every(([offset],i)=>!i||offset>=layer.stops[i-1][0]));
 }
});
test('repeating rings retain 39px period across tile sizes',()=>{
 for(const size of [420,460]){const lower=topographyLayers(size)[0],starts=lower.stops.filter(([,alpha])=>alpha===.045).map(([offset])=>offset*lower.rx);assert.ok(Math.abs(starts[2]-starts[0]-39)<1e-10);assert.ok(Math.abs(starts[1]-starts[0]-1)<1e-10);}
});

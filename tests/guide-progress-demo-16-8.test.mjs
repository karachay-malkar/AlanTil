import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createGuideProgressTimeline,guideProgressClipY,guideProgressDuration,guideProgressIntervalWeight,guideProgressOffsetAt,guideProgressRouteProgressAt,guideProgressPulseDuration,orderGuideProgressStations} from '../packages/alantil-core/guide-progress-demo.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file)=>fs.readFileSync(path.join(ROOT,file),'utf8');
const stations=()=>orderGuideProgressStations(Array.from({length:12},(_,index)=>({key:String(index),y:1200-index*100})));

test('first stage lights at t=0 and first four accelerate about ten percent per interval',()=>{
  const timeline=createGuideProgressTimeline(stations());
  assert.equal(timeline[0].triggerProgress,0);
  assert.equal(guideProgressIntervalWeight(1,12),1);
  assert.equal(guideProgressIntervalWeight(2,12),.9);
  assert.equal(guideProgressIntervalWeight(3,12),.81);
  const intervals=[1,2,3].map(index=>timeline[index].triggerProgress-timeline[index-1].triggerProgress);
  assert.ok(Math.abs(intervals[1]/intervals[0]-.9)<1e-9);
  assert.ok(Math.abs(intervals[2]/intervals[1]-.9)<1e-9);
});

test('middle stages are faster and final three are slow with separate trigger moments',()=>{
  const timeline=createGuideProgressTimeline(stations());
  const middle=timeline[5].triggerProgress-timeline[4].triggerProgress;
  const penultimate=timeline[10].triggerProgress-timeline[9].triggerProgress;
  const last=timeline[11].triggerProgress-timeline[10].triggerProgress;
  assert.ok(middle<penultimate*.2);
  assert.ok(penultimate>0);
  assert.ok(last>penultimate);
  assert.notEqual(timeline[10].triggerProgress,timeline[11].triggerProgress);
  assert.equal(timeline.at(-1).routeProgress,1);
});

test('camera and route line progress stay smooth and monotone',()=>{
  const timeline=createGuideProgressTimeline(stations());
  const values=Array.from({length:1001},(_,index)=>guideProgressRouteProgressAt(index/1000,timeline));
  for(let index=1;index<values.length;index+=1)assert.ok(values[index]>=values[index-1]-1e-10);
  assert.equal(guideProgressOffsetAt(0,1400,timeline),1400);
  assert.equal(guideProgressOffsetAt(1,1400,timeline),0);
  assert.equal(guideProgressClipY(0,1200,100),1200);
  assert.equal(guideProgressClipY(1,1200,100),100);
});

test('animation is materially faster through the middle',()=>{
  const duration=guideProgressDuration({stationCount:12});
  assert.ok(duration>=6000&&duration<=8500);
  assert.equal(guideProgressPulseDuration(0,12),1850);
  assert.equal(guideProgressPulseDuration(4,12),650);
  assert.equal(guideProgressPulseDuration(11,12),2200);
});

test('Web first station is immediate and gold stroke uses the same dotted path geometry',()=>{
  const guide=read('src/features/onboarding/guide.js');
  assert.match(guide,/if \(ordered\[0\]\) triggerGuideDemoStation/);
  assert.match(guide,/routeConnectorPath alantilGuideDemoConnectorBase/);
  assert.match(guide,/routeConnectorPath alantilGuideDemoConnectorProgress/);
  assert.match(guide,/stroke-dasharray:3 7/);
  assert.match(guide,/guideProgressRouteProgressAt/);
  assert.match(guide,/t >= ordered\[nextIndex\]\.triggerProgress/);
});

test('Mobile uses the exact existing connector d for both gray and gold dotted strokes',()=>{
  const mobile=read('mobile/screens/path.js');
  assert.match(mobile,/<SvgPath d=\{connector\} fill="none" stroke="rgba\(102,97,88,\.38\)"/);
  assert.match(mobile,/<SvgPath d=\{connector\} clipPath="url\(#guideRouteProgressClip\)"/);
  assert.match(mobile,/strokeDasharray="3 7"/);
  assert.match(mobile,/if\(ordered\[0\]\)triggerGuideDemoStation/);
  assert.match(mobile,/t>=ordered\[nextIndex\]\.triggerProgress/);
  assert.doesNotMatch(mobile,/guideConnector\.path/);
  assert.doesNotMatch(mobile,/setProgressMap\([^\n]*guideDemo/);
});

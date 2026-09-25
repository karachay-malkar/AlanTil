import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {GUIDE_PROGRESS_CENTER_PLATEAU_INTERVALS,createGuideProgressTimeline,guideProgressClipY,guideProgressDuration,guideProgressIntervalWeight,guideProgressOffsetAt,guideProgressRouteProgressAt,guideProgressPulseDuration,orderGuideProgressStations} from '../packages/alantil-core/guide-progress-demo.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file)=>fs.readFileSync(path.join(ROOT,file),'utf8');
const stations=(count=26)=>orderGuideProgressStations(Array.from({length:count},(_,index)=>({key:String(index),y:2600-index*100})));
const intervalMs=(count=26)=>Array.from({length:Math.max(0,count-1)},(_,index)=>Math.round(guideProgressIntervalWeight(index+1,count)*1100));

test('first stage lights at t=0 and timing follows a continuous quadratic ramp',()=>{
  const timeline=createGuideProgressTimeline(stations());
  assert.equal(timeline[0].triggerProgress,0);
  assert.equal(GUIDE_PROGRESS_CENTER_PLATEAU_INTERVALS,5);
  assert.deepEqual(intervalMs(),[
    875,742,623,518,427,350,287,238,203,182,
    175,175,175,175,175,
    182,203,238,287,350,427,518,623,742,875,
  ]);
});

test('intervals accelerate monotonically into five equal middle transitions then decelerate',()=>{
  const values=intervalMs();
  const plateauStart=10,plateauEnd=14;
  for(let index=1;index<=plateauStart;index+=1)assert.ok(values[index]<=values[index-1],`expected acceleration at interval ${index+1}`);
  assert.deepEqual(values.slice(plateauStart,plateauEnd+1),[175,175,175,175,175]);
  for(let index=plateauEnd+1;index<values.length;index+=1)assert.ok(values[index]>=values[index-1],`expected deceleration at interval ${index+1}`);
});

test('quadratic timing is mirror-symmetric around the middle plateau',()=>{
  const values=intervalMs();
  assert.deepEqual(values,values.slice().reverse());
  const left=values.slice(0,10);
  const drops=left.slice(1).map((value,index)=>left[index]-value);
  for(let index=1;index<drops.length;index+=1)assert.ok(drops[index]<=drops[index-1],`expected quadratic easing of interval deltas at ${index}`);
});

test('middle stages are materially faster without a step change at the plateau edges',()=>{
  const values=intervalMs();
  assert.ok(values[0]/values[10]>=4.9);
  assert.equal(values[9]-values[10],7);
  assert.equal(values[15]-values[14],7);
  assert.notEqual(values.at(-2),values.at(-1));
});

test('camera and route line progress stay smooth and monotone',()=>{
  const timeline=createGuideProgressTimeline(stations());
  const values=Array.from({length:2001},(_,index)=>guideProgressRouteProgressAt(index/2000,timeline));
  for(let index=1;index<values.length;index+=1)assert.ok(values[index]>=values[index-1]-1e-10);
  assert.equal(guideProgressOffsetAt(0,2800,timeline),2800);
  assert.equal(guideProgressOffsetAt(1,2800,timeline),0);
  assert.equal(guideProgressClipY(0,2600,100),2600);
  assert.equal(guideProgressClipY(1,2600,100),100);
});

test('total duration remains near the previous ten-second presentation window',()=>{
  const duration=guideProgressDuration({stationCount:26});
  assert.ok(duration>=9600&&duration<=9900);
  assert.equal(duration,9765);
});

test('station pulse durations follow the same smooth speed profile',()=>{
  const pulses=Array.from({length:26},(_,index)=>guideProgressPulseDuration(index,26));
  assert.equal(pulses[0],2200);
  assert.equal(Math.min(...pulses),650);
  assert.equal(pulses.at(-1),2200);
  for(let index=2;index<=10;index+=1)assert.ok(pulses[index]<=pulses[index-1]);
  for(let index=16;index<pulses.length;index+=1)assert.ok(pulses[index]>=pulses[index-1]);
});

test('Web and Mobile share the common quadratic timing engine and existing dotted route geometry',()=>{
  const web=read('src/features/onboarding/guide.js');
  const mobile=read('mobile/screens/path.js');
  const core=read('packages/alantil-core/guide-progress-demo.js');
  assert.match(web,/guideProgressRouteProgressAt/);
  assert.match(web,/guideProgressPulseDuration/);
  assert.match(web,/t >= ordered\[nextIndex\]\.triggerProgress/);
  assert.match(web,/stroke-dasharray:3 7/);
  assert.match(mobile,/guideProgressRouteProgressAt/);
  assert.match(mobile,/guideProgressPulseDuration/);
  assert.match(mobile,/t>=ordered\[nextIndex\]\.triggerProgress/);
  assert.match(mobile,/strokeDasharray="3 7"/);
  assert.match(core,/distance\*distance/);
  assert.doesNotMatch(core,/OPENING_INTERVAL_WEIGHTS|FAST_MIDDLE_WEIGHT|CLOSING_INTERVAL_WEIGHTS|GUIDE_PROGRESS_SLOW_START_COUNT|GUIDE_PROGRESS_SLOW_END_COUNT/);
});

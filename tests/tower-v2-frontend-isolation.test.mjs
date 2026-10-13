import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const source=p=>readFileSync(new URL(p,root),'utf8');
test('17.2 uses the single V2 editor while blocking untrusted legacy mutations',()=>{
 const script=source('src/features/tower/index.js');
 assert.match(script,/v2Play:true/);
 assert.match(script,/v2Enabled:true/);
 assert.doesNotMatch(script,/towerModeSwitch/);
 assert.match(script,/if\(s\.v2Enabled\&\&!s\.v2Play\)return;/);
 assert.match(script,/stone-placement-v2-worker\.js/);
 assert.match(script,/s\.v2CandidateValid/);
});
test('asynchronous worker has request sequence and revision guard',()=>{
 const script=source('src/features/tower/index.js'),worker=source('src/features/tower/stone-placement-v2-worker.js');
 assert.match(script,/requestId/);assert.match(script,/revision/);
 assert.match(script,/s\.v2Worker\?\.terminate\(\)/);
 assert.match(worker,/resolveTowerV2Proposal/);
 assert.match(worker,/postMessage/);
});
test('v2 never changes legacy route, purchases, release or RPC export',()=>{
 const script=source('src/features/tower/index.js');
 assert.match(script,/practice\.tower/);
 assert.match(script,/mutateTower/);
 assert.match(script,/s\.v2Play\?mutateTowerV2\(operation\):mutateTower\(operation\)/);
});

test('v2 camera data exposes physical meter aim without altering legacy cell coordinates',()=>{
 const scene=source('src/features/tower/scene.js'),script=source('src/features/tower/index.js');
 assert.match(scene,/enableV2Aim=false/);
 assert.match(scene,/,aimMeters}/);
 assert.match(script,/camera\.aimMeters/);
 assert.match(script,/camera\.target\.map\(v=>v\*\.25\)/);
});
test('v2 always protects mutation at RPC entry regardless of UI control state',()=>{
 const script=source('src/features/tower/index.js');
 assert.match(script,/async function submit\(operation\)\{if\(\(s\.v2Enabled\&\&!s\.v2Play\)\|\|s\.busy/);
 assert.match(script,/on\('\[data-remove\]'\,'click',\(\)=>\{if\(\(s\.v2Enabled\&\&!s\.v2Play\)/);
 assert.match(script,/root\.querySelectorAll\('\[data-exchange\]'\).*?if\(s\.v2Enabled/);
});

test('v2 valid preview uses a visible green unlit ghost and a non-error status',()=>{
 const scene=source('src/features/tower/scene.js'),index=source('src/features/tower/index.js');
 assert.match(scene,/enableV2Aim\&\&CATALOG_STONES\.has\(b\.type\)/);
 assert.match(scene,/THREE\.MeshBasicMaterial\(\{color:/);
 assert.match(index,/s\.v2Enabled\?false:Boolean\(message\)/);
});

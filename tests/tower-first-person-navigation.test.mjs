import test from 'node:test';
import assert from 'node:assert/strict';
import {canTowerExplorerLand,constrainTowerCamera,moveTowerExplorer,TOWER_EXPLORER} from '../src/features/tower/first-person-navigation.js';

const groundAt=()=>0;
const wall=[{min:{x:9,y:0,z:6},max:{x:11,y:3,z:14}}];
test('walk stays inside 15x30 lot and 1.7 m above physical ground',()=>{
 const start={x:1,y:1.7,z:1};
 const next=moveTowerExplorer(start,{forward:1,strafe:1,up:0},0,1,{groundAt,obstacles:[]});
 assert.ok(next.x<=14.68&&next.x>=.32);
 assert.ok(next.z>=.32&&next.z<=29.68);
 assert.equal(next.y,1.7);
 for(let i=0,p=start;i<40;i++)p=moveTowerExplorer(p,{forward:-1,strafe:-1},0,.08,{groundAt,obstacles:[]});
});
test('height buttons cannot go lower than eye or higher than 15m, including on steep terrain',()=>{
 const start={x:1,y:1.7,z:1};
 let p=start;
 for(let i=0;i<300;i++)p=moveTowerExplorer(p,{up:1},0,.05,{groundAt,obstacles:[]});
 assert.equal(p.y,TOWER_EXPLORER.maxHeight);
 for(let i=0;i<350;i++)p=moveTowerExplorer(p,{up:-1},0,.05,{groundAt,obstacles:[]});
 assert.equal(p.y,1.7);
 const limit=constrainTowerCamera({x:1,y:-100,z:2},()=>12,3);
 assert.equal(limit.y,15);
});
test('solid authored prefabs block movement and sliding preserves free axis',()=>{
 const start={x:8.3,y:1.7,z:10};
 const next=moveTowerExplorer(start,{strafe:1},0,.08,{groundAt,obstacles:wall});
 assert.ok(next.x<8.7,'player capsule cannot enter a stone section');
 const above=moveTowerExplorer({...start,y:5},{strafe:1},0,.08,{groundAt,obstacles:wall});
 assert.ok(above.x>start.x,'can move over geometry when whole capsule clears it');
});
test('world and construction orbit camera always remain above DEM',()=>{
 const floor=(x,z)=>x>10?25:0;
 const r=constrainTowerCamera({x:18,y:-8,z:10},floor,4);
 assert.equal(r.y,29);
 assert.deepEqual(constrainTowerCamera({x:5,y:10,z:5},floor,.3),{x:5,y:10,z:5});
});

test('descent over a real stone bounding box stops at the roof instead of falling through',()=>{
 const roof=[{min:{x:3,y:0,z:3},max:{x:7,y:4,z:7}}];
 let p={x:5,y:7,z:5};
 for(let i=0;i<200;i++)p=moveTowerExplorer(p,{up:-1},0,.05,{groundAt,obstacles:roof});
 assert.ok(p.y>=5.62,'capsule feet must remain above four-metre roof');
 assert.ok(!canTowerExplorerLand(p,groundAt,roof),'cannot switch to ground mode inside solid prefab');
 assert.equal(canTowerExplorerLand({x:2,y:4,z:2},groundAt,roof),true);
});

test('height arrows move smoothly from current altitude without jumping',()=>{
 const start={x:7.5,y:3,z:15};
 const up=moveTowerExplorer(start,{up:1},0,.05,{groundAt});
 const down=moveTowerExplorer(start,{up:-1},0,.05,{groundAt});
 assert.ok(up.y>start.y&&up.y-start.y<=.063);
 assert.ok(down.y<start.y&&start.y-down.y<=.063);
 assert.equal(up.x,start.x);assert.equal(up.z,start.z);
});

test('arrow release and horizontal movement preserve altitude at 1.25 m/s',()=>{
 const start={x:7.5,y:5,z:15};
 const up=moveTowerExplorer(start,{up:1},0,.05,{groundAt});
 const stopped=moveTowerExplorer(up,{up:0},0,.05,{groundAt});
 const walked=moveTowerExplorer(stopped,{forward:1},0,.05,{groundAt});
 assert.equal(TOWER_EXPLORER.verticalSpeed,1.25);
 assert.equal(stopped.y,up.y);
 assert.equal(walked.y,up.y);
});

test('first-person input starts counting elapsed time immediately',async()=>{
 const {readFile}=await import('node:fs/promises');
 const source=await readFile(new URL('../src/features/tower/tower-explorer-controller.js',import.meta.url),'utf8');
 assert.match(source,/if\(enabled&&!wasMoving&&moving\(\)\)lastFrame=performance\.now\(\)/);
 assert.match(source,/if\(!wasMoving&&moving\(\)\)lastFrame=performance\.now\(\)/);
});

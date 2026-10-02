import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as onlineModule from '../packages/ashyk-game/online.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(p)=>fs.readFileSync(path.join(ROOT,p),'utf8');

test('shared resign flow waits for the finished room after leaving',async()=>{
  assert.equal(typeof onlineModule.resignAshykRoom,'function');
  const calls=[];
  const finished={id:'room-1',status:'finished'};
  const online={
    async leaveRoom(id){calls.push(['leave',id]);},
    async getRoom(id){calls.push(['get',id]);return finished;},
  };
  const result=await onlineModule.resignAshykRoom(online,'room-1');
  assert.deepEqual(calls,[['leave','room-1'],['get','room-1']]);
  assert.equal(result,finished);
});

test('Web resignation stays on the game result until explicit exit',()=>{
  const web=read('packages/ashyk-game/web/Game.jsx');
  const feature=read('src/features/ashyk/index.js');
  assert.match(web,/resignAshykRoom/);
  const block=web.slice(web.indexOf('const resignCurrentGame=async'),web.indexOf('const claimForfeit=async'));
  assert.match(block,/await resignAshykRoom\(online,room\.id\)/);
  assert.match(block,/applyRoom\(next,true,true\)/);
  assert.doesNotMatch(block,/clearRoomLocal\(\)/);
  assert.doesNotMatch(block,/onExit\?\.\(\)/);
  assert.match(feature,/onExit\(\)\{void context\.router\.replace\('practice\.home'\);\}/);
});

test('Mobile resignation asks for confirmation and stays on the final result',()=>{
  const mobile=read('mobile/screens/ashyk.js');
  assert.match(mobile,/ConfirmDialog/);
  assert.match(mobile,/confirmResign/);
  assert.match(mobile,/resignAshykRoom/);
  const block=mobile.slice(mobile.indexOf('const endCurrentGame=async'),mobile.indexOf("if(access.locked)"));
  assert.match(block,/setResignConfirm\(true\)/);
  assert.doesNotMatch(block,/clearRoomLocal\(\)[\s\S]{0,120}onBack\?\.\(\)/);
});

test('finished online match explains resignation on both clients',()=>{
  const web=read('packages/ashyk-game/web/Game.jsx');
  const mobile=read('mobile/screens/ashyk.js');
  assert.match(web,/state\.lastOutcome\?\.code==='resigned'/);
  assert.match(web,/state\.lastOutcome\?\.code==='opponentResigned'/);
  assert.match(mobile,/state\.lastOutcome\?\.code==='resigned'/);
  assert.match(mobile,/state\.lastOutcome\?\.code==='opponentResigned'/);
});

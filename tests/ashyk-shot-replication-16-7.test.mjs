import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createAshykOnlineAdapter} from '../packages/ashyk-game/online.js';
import {createAshykOnlineSessionController} from '../packages/ashyk-game/session.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const field={pieces:[{id:0,alive:true,position:[0,1,0],quaternion:[0,0,0,1]},{id:1,alive:true,position:[3,1,0],quaternion:[0,0,0,1]}]};
const room=(overrides={})=>({id:'r1',status:'playing',host_user_id:'u1',guest_user_id:'u2',active_user_id:'u2',phase_seq:7,revision:10,...overrides});

test('engine exposes replicated shot start, correction frames and visual-only remote playback hooks',()=>{
  const source=fs.readFileSync(path.join(ROOT,'packages/ashyk-game/engine.js'),'utf8');
  assert.match(source,/emit\('shot',\{id:piece\.id,mode,directionX,directionZ,pullLength:effectivePull,pullRatio:ratio,state:initialState\}\)/);
  assert.match(source,/emit\('shotFrame',\{state:snapshot\(\),final:false\}\)/);
  assert.match(source,/function launchRemote\(id,options=\{\}\)/);
  assert.match(source,/remoteOnly\?'remoteShotSettled':'shotSettled'/);
  assert.match(source,/function applyRemoteFrame\(state\)/);
});
test('online adapter creates private room-scoped Broadcast stream',()=>{
  const handlers=new Map(),sent=[];let topic='',config=null,subscription=null;
  const channel={on(type,filter,callback){handlers.set(filter.event,callback);return this;},subscribe(callback){subscription=callback;callback('SUBSCRIBED');return this;},send(message){sent.push(message);return Promise.resolve('ok');},unsubscribe(){}};
  const client={rpc:async()=>({data:null,error:null}),channel(nextTopic,nextConfig){topic=nextTopic;config=nextConfig;return channel;},removeChannel(){}};
  const online=createAshykOnlineAdapter(client),received=[];
  const stream=online.openShotStream('r1',(event,payload)=>received.push([event,payload]));
  assert.equal(topic,'ashyk-shot:r1');
  assert.equal(config.config.private,true);
  stream.send('shot-start',{shotId:'s1'});
  assert.equal(sent[0].type,'broadcast');
  assert.equal(sent[0].event,'shot-start');
  handlers.get('shot-frame')({payload:{shotId:'s1',seq:1}});
  assert.deepEqual(received[0],['shot-frame',{shotId:'s1',seq:1}]);
  assert.equal(typeof subscription,'function');
  stream.close();
});

test('session validates opponent shot and replays start plus correction frames',()=>{
  let visualReceiver=null;const sent=[],calls=[];
  const online={openShotStream(roomId,onVisual){visualReceiver=onVisual;return{send:(event,payload)=>{sent.push([event,payload]);return true;},close(){}};}};
  let current=room();
  const engine={applySnapshot(state){calls.push(['snapshot',state]);return true;},launchRemote(id,params){calls.push(['launch',id,params]);return true;},applyRemoteFrame(state){calls.push(['frame',state]);return true;}};
  const store={getState:()=>({gameMode:'online'}),onlineGameState:()=>({})};
  const session=createAshykOnlineSessionController({online,userId:'u1',store,engine,getRoom:()=>current,applyRoom(){}});
  session.attachVisual('r1');
  visualReceiver('shot-start',{roomId:'r1',actorUserId:'u2',phaseSeq:7,shotId:'s1',pieceId:0,mode:'flat',directionX:1,directionZ:0,pullRatio:.7,pullLength:4,state:field});
  assert.equal(calls[0][0],'snapshot');
  assert.equal(calls[1][0],'launch');
  visualReceiver('shot-frame',{roomId:'r1',actorUserId:'u2',phaseSeq:7,shotId:'s1',seq:1,state:field});
  assert.equal(calls[2][0],'frame');
  visualReceiver('shot-frame',{roomId:'r1',actorUserId:'u1',phaseSeq:7,shotId:'forged',seq:2,state:field});
  assert.equal(calls.length,3);

  current=room({active_user_id:'u1'});
  session.handleEngineEvent({type:'shot',id:0,mode:'flat',directionX:1,directionZ:0,pullRatio:.7,pullLength:4,state:field});
  session.handleEngineEvent({type:'shotFrame',state:field,final:false});
  assert.equal(sent[0][0],'shot-start');
  assert.equal(sent[1][0],'shot-frame');
  assert.equal(sent[0][1].actorUserId,'u1');
  session.destroy();
});

test('Web and Mobile route engine visual events through the shared session controller',()=>{
  const web=fs.readFileSync(path.join(ROOT,'packages/ashyk-game/web/Game.jsx'),'utf8');
  const mobile=fs.readFileSync(path.join(ROOT,'mobile/screens/ashyk.js'),'utf8');
  for(const source of[web,mobile]){
    assert.match(source,/handleEngineEvent\(event\)/);
    assert.match(source,/attachVisual\(room\.id\)/);
    assert.match(source,/store,engine,getRoom/);
  }
});

test('Supabase private Broadcast policies are room-member and active-player scoped',()=>{
  const files=fs.readdirSync(path.join(ROOT,'supabase/migrations'));
  const name=files.find(value=>value.includes('ashyk_shot_broadcast'));
  assert.ok(name);
  const sql=fs.readFileSync(path.join(ROOT,'supabase/migrations',name),'utf8');
  assert.match(sql,/on realtime\.messages/);
  assert.match(sql,/for select/);
  assert.match(sql,/for insert/);
  assert.match(sql,/realtime\.topic\(\)/);
  assert.match(sql,/active_user_id=\(select auth\.uid\(\)\)/);
  assert.match(sql,/host_user_id/);
  assert.match(sql,/guest_user_id/);
});

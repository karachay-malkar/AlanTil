import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createAshykOnlineAdapter} from '../packages/ashyk-game/online.js';
import {createAshykOnlineSessionController} from '../packages/ashyk-game/session.js';
import {createAshykGameStore} from '../packages/ashyk-game/store.js';
import {interpolateTrajectoryFrames,validateTrajectoryPacket} from '../packages/ashyk-game/trajectory.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file)=>fs.readFileSync(path.join(ROOT,file),'utf8');
const motionField={pieces:[
  {id:0,alive:true,position:[0,1,0],quaternion:[0,0,0,1],velocity:[8,0,0],angularVelocity:[0,0,0]},
  {id:1,alive:true,position:[3,1,0],quaternion:[0,0,0,1],velocity:[0,0,0],angularVelocity:[0,0,0]},
]};
const stillField={pieces:motionField.pieces.map(({velocity,angularVelocity,...piece})=>piece)};
const trajectoryCore={durationMs:50,frames:[{t:0,pieces:stillField.pieces},{t:50,pieces:stillField.pieces.map((piece)=>piece.id===0?{...piece,position:[1,1,0]}:piece)}],impacts:[{t:25,kind:'ashyk',strength:2.4,key:'0:1',pan:.2}],finalState:{pieces:stillField.pieces.map((piece)=>piece.id===0?{...piece,position:[1,1,0]}:piece)},result:{success:false,hitAny:true,reasonCode:'miss',remainingPieces:2}};
const room=(overrides={})=>({id:'r1',status:'playing',protocol_version:3,host_user_id:'u1',guest_user_id:'u2',active_user_id:'u2',phase:'first-shot',phase_seq:7,revision:10,last_action_type:null,last_action_actor_user_id:null,game_state:{field:stillField,scores:[0,0],remainingAshyks:10,difficulty:'normal',phase:'first-shot'},...overrides});

test('trajectory engine removes streaming interpolation and keeps authoritative deferral',()=>{
  const source=read('packages/ashyk-game/engine.js');
  assert.match(source,/simulateShotTrajectory/);assert.match(source,/function playRemoteTrajectory/);assert.match(source,/pendingAuthoritative/);assert.match(source,/TRAJECTORY_FRAME_MS/);assert.match(source,/preShotState=physicsSnapshot\(\)/);
  assert.doesNotMatch(source,/REMOTE_BUFFER_MS|REMOTE_EXTRAPOLATE_MS|beginRemotePlayback|pushRemoteFrame|shotFrame/);
});

test('trajectory packet is compact, validated and locally interpolated',()=>{
  const packet={roomId:'r1',actorUserId:'u2',phaseSeq:7,shotId:'s1',pieceId:0,mode:'flat',directionX:1,directionZ:0,pullLength:4,pullRatio:.7,...trajectoryCore};
  assert.equal(validateTrajectoryPacket(packet),true);assert.equal('velocity' in packet.frames[0].pieces[0],false);assert.equal('angularVelocity' in packet.frames[0].pieces[0],false);
  const mid=interpolateTrajectoryFrames(packet.frames[0],packet.frames[1],25);assert.equal(mid.pieces[0].position[0],.5);assert.ok(Math.abs(Math.hypot(...mid.pieces[0].quaternion)-1)<1e-9);
});

test('private Broadcast carries shot-trajectory and no legacy physics stream',async()=>{
  const handlers=new Map(),sent=[],order=[];let topic='',config=null;
  const channel={on(type,filter,callback){handlers.set(filter.event,callback);return this;},subscribe(callback){order.push('subscribe');callback('SUBSCRIBED');return this;},send(message){sent.push(message);return Promise.resolve('ok');},unsubscribe(){}};
  const client={rpc:async()=>({data:null,error:null}),realtime:{async setAuth(){order.push('auth');}},channel(nextTopic,nextConfig){order.push('channel');topic=nextTopic;config=nextConfig;return channel;},removeChannel(){}};
  const online=createAshykOnlineAdapter(client),received=[],stream=online.openVisualStream('r1',(event,payload)=>received.push([event,payload]));await stream.ready;
  assert.deepEqual(order.slice(0,3),['auth','channel','subscribe']);assert.equal(topic,'ashyk-shot:r1');assert.equal(config.config.private,true);
  for(const event of ['piece-selected','piece-deselected','shot-mode','aim-update','aim-clear','question-select','question-submit','question-skip','shot-trajectory'])assert.equal(typeof handlers.get(event),'function',event);
  for(const event of ['shot-start','shot-frame','impact'])assert.equal(handlers.has(event),false,event);
  stream.send('shot-trajectory',{shotId:'s1'});assert.equal(sent.at(-1).event,'shot-trajectory');stream.close();
});

test('session replays duplicate trajectory once and sends exactly one precomputed trajectory',async()=>{
  let visualReceiver=null;const sent=[],calls=[];
  const online={openVisualStream(roomId,onVisual,onStatus){visualReceiver=onVisual;onStatus('online');return{send:(event,payload)=>{sent.push([event,payload]);return true;},close(){},ready:Promise.resolve(true)};}};
  let current=room();
  const engine={setRemoteSelection(id){calls.push(['selection',id]);},setRemoteAim(value){calls.push(['aim',value]);},playRemoteTrajectory(value){calls.push(['trajectory',value]);return true;},simulateShotTrajectory(){return trajectoryCore;}};
  const store={getState:()=>({gameMode:'online'}),onlineGameState:()=>({}),applyRemoteVisual(){}};
  const session=createAshykOnlineSessionController({online,userId:'u1',store,engine,getRoom:()=>current,applyRoom(){}});session.attachVisual('r1');
  const packet={roomId:'r1',actorUserId:'u2',phaseSeq:7,eventId:'e1',shotId:'s1',pieceId:0,mode:'flat',directionX:1,directionZ:0,pullLength:4,pullRatio:.7,...trajectoryCore};
  visualReceiver('shot-trajectory',packet);visualReceiver('shot-trajectory',packet);assert.equal(calls.filter(([type])=>type==='trajectory').length,1);
  current=room({active_user_id:'u1'});session.handleEngineEvent({type:'shot',id:0,mode:'flat',directionX:1,directionZ:0,pullRatio:.7,pullLength:4,preShotState:motionField});
  await new Promise((resolve)=>setTimeout(resolve,15));
  assert.equal(sent.filter(([event])=>event==='shot-trajectory').length,1);assert.equal(sent.some(([event])=>['shot-start','shot-frame','impact'].includes(event)),false);session.destroy();
});

test('remote authoritative answer reproduces score, selected answer, correctness and the same outcome banner',()=>{
  const timers=[];
  const engine={applyAuthoritativeSnapshot(){return true;},setRemoteSelection(){},setRemoteAim(){},clearSelection(){},snapshot(){return stillField;}};
  const store=createAshykGameStore({engine,words:[],now:()=>0,setRepeater:()=>1,clearRepeater(){},setTimer:(fn)=>{timers.push(fn);return timers.length;},clearTimer(){}});
  const question={id:'q1',prompt:'алан',answer:'слово',answerId:'w1',options:[{id:'w1',text:'слово'},{id:'w2',text:'другое'}]};
  store.hydrateOnline(room({active_user_id:'u2',phase:'bonus-question',game_state:{field:stillField,scores:[0,0],remainingAshyks:9,difficulty:'normal',phase:'bonus-question',question,questionLocked:false}}),'u1');
  store.applyRemoteVisual('question-select',{optionId:'w2'});
  store.hydrateOnline(room({active_user_id:'u1',revision:11,phase_seq:8,phase:'first-shot',last_action_id:'a-wrong',last_action_type:'answer_wrong',last_action_actor_user_id:'u2',game_state:{field:stillField,scores:[0,-1],remainingAshyks:9,difficulty:'normal',phase:'first-shot',question:null,questionLocked:false,lastOutcome:{actionId:'a-wrong',actorPlayer:2,code:'wrong',delta:-1,selectedOptionId:'w2',correctOptionId:'w1'}}}),'u1');
  const state=store.getState();
  assert.deepEqual(state.scores,[0,-1]);
  assert.equal(state.outcome?.code,'wrong');
  assert.equal(state.questionReview?.selectedOptionId,'w2');
  assert.equal(state.questionReview?.correctOptionId,'w1');
  assert.equal(state.questionReview?.resultCode,'wrong');
  assert.equal(state.scorePulse?.player,2);
  store.destroy();
});

test('Web and Mobile expose opponent answer feedback, current-game controls and live shot mode',()=>{
  const web=read('packages/ashyk-game/web/Game.jsx'),mobile=read('mobile/screens/ashyk.js');
  for(const source of[web,mobile]){
    assert.match(source,/question-select/);
    assert.match(source,/question-submit/);
    assert.match(source,/remoteQuestionSelectedId/);
    assert.match(source,/scorePulse/);
    assert.match(source,/remoteShotMode/);
    assert.match(source,/currentGame/);
    assert.match(source,/online\.leaveRoom\(room\.id\)/);
  }
});

test('board is physically and visually reduced to 85 percent through the shared BOARD constant',()=>{
  const constants=read('packages/ashyk-game/constants.js'),wood=read('packages/ashyk-game/model/wood-board.js');
  assert.match(constants,/export const BOARD=23\.8;/);
  assert.match(constants,/export const BOARD_SCALE=BOARD\/BOARD_REFERENCE;/);
  assert.match(wood,/topRadius:HALF-/);
  assert.match(wood,/outerRing:BOUNDARY_RADIUS/);
});

test('impact audio is replayed from trajectory timestamps and never sent standalone',()=>{
  const session=read('packages/ashyk-game/session.js'),engine=read('packages/ashyk-game/engine.js'),webAudio=read('packages/ashyk-game/web/audio.js'),mobileAudio=read('mobile/game/ashyk-audio.js');
  assert.doesNotMatch(session,/visualStream\.send\('impact'/);assert.match(engine,/trajectory\.impacts/);assert.match(engine,/emit\('impact'/);
  assert.match(webAudio,/threshold:\.035/);assert.match(webAudio,/pendingImpacts/);assert.match(webAudio,/preload/);assert.match(mobileAudio,/threshold:\.035/);assert.match(mobileAudio,/attempt<1/);
  for(const source of[webAudio,mobileAudio]){assert.doesNotMatch(source,/31\.28|34\.65|36\.7|17\.86|10\.03|23\.05/);assert.match(source,/const starts=\[\.08,\.28,\.48\]/);}
});

test('lobby recovery always offers return plus server-side close and preparing rooms can be cancelled',()=>{
  const bootstrap=read('src/app/bootstrap.js'),app=read('mobile/AppRoot.js'),web=read('packages/ashyk-game/web/Game.jsx'),mobile=read('mobile/screens/ashyk.js');
  assert.match(bootstrap,/online\.leaveRoom\(resumable\.id\)/);
  assert.match(bootstrap,/secondaryText/);
  assert.match(bootstrap,/dismissible:false/);
  assert.match(read('src/shared/ui/modal.js'),/dismissible = true/);
  assert.match(app,/closeGlobalAshyk/);
  assert.match(app,/onCloseRoom/);
  for(const source of[web,mobile]){
    assert.match(source,/const cancelInvite=async\(\)=>\{const room=/);
    assert.match(source,/online\.leaveRoom\(room\.id\)/);
  }
  assert.doesNotMatch(web,/!preparing\?<button[^>]+cancelInvite/);
  assert.doesNotMatch(mobile,/!preparing\?<AshykButton[^>]+cancelInvite/);
});

test('Supabase private Broadcast policies remain room-member and active-player scoped',()=>{
  const files=fs.readdirSync(path.join(ROOT,'supabase/migrations'));
  const name=files.find(value=>value.includes('ashyk_shot_broadcast'));
  assert.ok(name);
  const sql=read(path.join('supabase/migrations',name));
  assert.match(sql,/on realtime\.messages/);
  assert.match(sql,/for select/);
  assert.match(sql,/for insert/);
  assert.match(sql,/realtime\.topic\(\)/);
  assert.match(sql,/active_user_id=\(select auth\.uid\(\)\)/);
  assert.match(sql,/host_user_id/);
  assert.match(sql,/guest_user_id/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const deps=process.env.ASHYK_REACT_TEST_DEPS;
test('Web renderer locks double Challenge before build await; restored room does not wait for vocabulary',{skip:!deps},async()=>{
 const root=path.resolve(import.meta.dirname,'..');
 const require=createRequire(path.join(deps,'package.json'));
 const React=require('react'),{act,create}=require('react-test-renderer');
 const {build}=createRequire(path.join(root,'tools/ashyk-web/package.json'))('esbuild');
 const outfile=path.join(deps,'ashyk-recovery-game.cjs');
 await build({entryPoints:[path.join(root,'packages/ashyk-game/web/Game.jsx')],outfile,bundle:true,format:'cjs',platform:'node',jsx:'automatic',external:['react','react/jsx-runtime'],plugins:[{name:'renderer-boundaries',setup(b){
  b.onLoad({filter:/ashyk-game\/engine\.js$/},()=>({contents:`export function createAshykEngine(){return {settleInitial(){},isReady:()=>true,snapshot:()=>({pieces:[]}),getAliveCount:()=>10,applyAuthoritativeSnapshot(){},destroy(){},reset(){}}}`}));
  b.onLoad({filter:/ashyk-game\/web\/scene\.jsx$/},()=>({contents:'export function AshykWebScene(){return null}'}));
  b.onLoad({filter:/ashyk-game\/web\/audio\.js$/},()=>({contents:'export function createWebAshykAudio(){return {playUiClick(){},preload(){},dispose(){},unlock(){}}}'}));
 } }]});
 const {AshykGame}=require(outfile);
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.window={addEventListener(){},removeEventListener(){}};
 let instance,buildResolve,creates=0,ready=0,notReady=0;
 const initialRoom={id:'r',status:'waiting',host_user_id:'h',guest_user_id:null,active_user_id:'h',revision:1,phase_seq:0,game_state:{scores:[0,0]}};
 const channel=()=>({on(){return this;},subscribe(){return this;},unsubscribe(){}});
 const client={channel,removeChannel:async()=>{},rpc:async(name)=>{
  if(name==='ashyk_players_snapshot')return{data:[{user_id:'g',action:'challenge',nickname:'Guest'}]};
  if(name==='ashyk_invite_create'){creates++;return{data:{room:initialRoom}};}
  if(name==='ashyk_room_ready')ready++;
  if(name==='ashyk_room_not_ready')notReady++;
  return{data:initialRoom};
 }};
 try{
  await act(async()=>{instance=create(React.createElement(AshykGame,{userId:'h',supabaseClient:client,initialChallengeUserId:'g',ensureOnlineBuild:()=>new Promise(r=>buildResolve=r)}));await new Promise(r=>setTimeout(r,20));});
  // Auto-challenge starts after the prepared field rerender; await that turn.
  await act(async()=>{await new Promise(r=>setTimeout(r,25));});
  const button=instance.root.findAllByType('button').find(b=>b.props.className==='ashykPlayerAction');
  assert.ok(buildResolve,'challenge reached build boundary');
  await act(async()=>{button.props.onClick();button.props.onClick();});
  assert.equal(creates,0);
  await act(async()=>{buildResolve(true);});
  assert.equal(creates,1);
  await act(async()=>instance.unmount());
  ready=0;notReady=0;let resolveWords;
  const vocabularyTask=new Promise(r=>resolveWords=r);
  await act(async()=>{instance=create(React.createElement(AshykGame,{userId:'h',supabaseClient:client,initialRoom,vocabularyTask}));});
  assert.ok(instance.root.findAll(n=>n.props.className==='ashykWaiting').length);
  assert.equal(ready,0);assert.equal(notReady,1);
  await act(async()=>{resolveWords({words:[]});await new Promise(r=>setTimeout(r,1100));});
  assert.ok(ready>=1);
 }finally{if(instance)await act(async()=>instance.unmount());delete globalThis.window;delete globalThis.IS_REACT_ACT_ENVIRONMENT;fs.rmSync(outfile,{force:true});}
});

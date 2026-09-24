import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createAshykGameStore} from '../packages/ashyk-game/store.js';
import {createAshykOnlineAdapter,ASHYK_ONLINE_PROTOCOL_VERSION} from '../packages/ashyk-game/online.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(p)=>fs.readFileSync(path.join(ROOT,p),'utf8');
const engine=()=>({reset(){},clearSelection(){},snapshot(){return{pieces:[]};},applySnapshot(){},isReady(){return true;}});
const room=(overrides={})=>({id:'r1',status:'playing',protocol_version:4,host_user_id:'u1',guest_user_id:'u2',active_user_id:'u1',revision:3,turn_no:1,phase:'first-shot',phase_seq:4,phase_deadline_at:'1970-01-01T00:00:15.000Z',last_action_type:null,game_state:{scores:[0,0],remainingAshyks:10,difficulty:'normal',field:{pieces:[]},phase:'first-shot'},...overrides});

test('online clock is derived from server deadline and never hands the turn over locally',()=>{
  let now=0,tick=null;
  const host=createAshykGameStore({engine:engine(),words:[],now:()=>now,setRepeater:(fn)=>{tick=fn;return 1;},clearRepeater(){},setTimer:()=>1,clearTimer(){}});
  host.hydrateOnline(room(),'u1');assert.equal(host.getState().shotSeconds,15);now=15000;tick();assert.equal(host.getState().shotSeconds,0);assert.equal(host.getState().player,1);assert.equal(host.getState().onlineAction,null);
  const guest=createAshykGameStore({engine:engine(),words:[],now:()=>now,setRepeater:()=>1,clearRepeater(){},setTimer:()=>1,clearTimer(){}});
  guest.hydrateOnline(room({active_user_id:'u2',revision:4,turn_no:2,phase_seq:5,phase_deadline_at:'1970-01-01T00:00:30.000Z',game_state:{scores:[0,0],remainingAshyks:10,difficulty:'normal',field:{pieces:[]},phase:'first-shot',currentPlayer:2}}),'u2');
  assert.equal(guest.getState().shotSeconds,15);assert.equal(guest.getState().player,2);host.destroy();guest.destroy();
});

test('online serialization never persists countdown seconds',()=>{const store=createAshykGameStore({engine:engine(),words:[],now:()=>0,setRepeater:()=>1,clearRepeater(){},setTimer:()=>1,clearTimer(){}});store.hydrateOnline(room(),'u1');const state=store.onlineGameState();assert.equal('shotSeconds' in state,false);assert.equal('questionSeconds' in state,false);store.destroy();});

test('online wrong answer advances immediately with one typed action instead of a stale delayed callback',()=>{
  const words=Array.from({length:6},(_,i)=>({id:`w${i}`,word:`alan${i}`,trans:`ru${i}`,pos:'noun',usedInTest:true,dictionary_id:'intermediate',story_id:'roots',synonyms:[]}));
  const store=createAshykGameStore({engine:engine(),words,now:()=>0,setRepeater:()=>1,clearRepeater(){},setTimer:()=>1,clearTimer(){}});
  store.hydrateOnline(room({phase:'bonus-question',phase_seq:8,phase_deadline_at:'1970-01-01T00:00:10.000Z',game_state:{scores:[0,0],remainingAshyks:9,difficulty:'normal',field:{pieces:[]},phase:'bonus-question',question:{id:'w0',prompt:'alan0',answer:'ru0',answerId:'w0',options:[{id:'w0',text:'ru0'},{id:'w1',text:'ru1'}]},questionLocked:false}}),'u1');
  assert.equal(store.submitAnswer('w1'),false);const state=store.getState();assert.equal(state.player,2);assert.equal(state.phase,'first-shot');assert.equal(state.onlineAction?.type,'answer_wrong');store.destroy();
});

test('online adapter commits a shot before authoritative result and keeps timeout RPC separate',async()=>{const calls=[];const channel={on(){return this;},subscribe(){return this;},unsubscribe(){}};const client={rpc:async(name,args)=>{calls.push([name,args]);if(name==='ashyk_shot_commit')return{data:{...room(),shot_in_flight_id:args.p_shot_id,shot_in_flight_phase_seq:args.p_expected_phase_seq},error:null};if(name==='ashyk_submit_action')return{data:{...room(),last_action_id:args.p_action_id,revision:4,phase_seq:5},error:null};return{data:room(),error:null};},channel:()=>channel,removeChannel(){}};const online=createAshykOnlineAdapter(client);assert.equal(ASHYK_ONLINE_PROTOCOL_VERSION,4);await online.commitShot(room(),4,'shot-1');await online.submitAction(room(),4,'shot-1','shot_result',{scores:[0,0],currentPlayer:2,remainingAshyks:10,difficulty:'normal',phase:'first-shot'},'u2','playing');await online.resolveTimeout('r1');await online.claimForfeit('r1');assert.equal(calls[0][0],'ashyk_shot_commit');assert.deepEqual(Object.keys(calls[0][1]),['p_room_id','p_expected_revision','p_expected_phase_seq','p_shot_id']);assert.equal(calls[1][0],'ashyk_submit_action');assert.equal(calls[2][0],'ashyk_resolve_timeout');assert.equal(calls[3][0],'ashyk_claim_forfeit');});

test('database migration defines server deadlines, phase sequencing, idempotent actions and resign/forfeit results',()=>{const sql=read('supabase/migrations/20260921104928_alantil_16_7_ashyk_authoritative_turns.sql');for(const token of ['protocol_version','turn_no','phase_seq','phase_deadline_at','last_action_id','last_action_type','winner_user_id','finish_reason','ashyk_action_log','ashyk_submit_action','ashyk_resolve_timeout','ashyk_claim_forfeit'])assert.match(sql,new RegExp(token));assert.match(sql,/p_expected_phase_seq/);assert.match(sql,/p_action_id/);assert.match(sql,/phase_deadline_at\s*<=\s*now\(\)/);assert.match(sql,/finish_reason='resign'/);assert.match(sql,/finish_reason='disconnect'/);});
test('Web and Mobile share the ordered online-session controller',()=>{const session=read('packages/ashyk-game/session.js'),web=read('packages/ashyk-game/web/Game.jsx'),mobile=read('mobile/screens/ashyk.js');assert.match(session,/queue\.push/);assert.match(session,/last_action_id/);assert.match(session,/resolveTimeoutIfDue/);assert.match(web,/createAshykOnlineSessionController/);assert.match(mobile,/createAshykOnlineSessionController/);assert.doesNotMatch(web,/pendingSync|syncing\.current/);assert.doesNotMatch(mobile,/pendingSync|syncing\.current/);});


test('protocol v4 accepts current rooms and rejects active legacy v3 rooms',async()=>{
  const channel={on(){return this;},subscribe(){return this;},unsubscribe(){}};
  const clientFor=(protocol_version)=>({rpc:async()=>({data:room({protocol_version}),error:null}),channel:()=>channel,removeChannel(){}});
  assert.equal((await createAshykOnlineAdapter(clientFor(4)).getRoom('r1')).protocol_version,4);
  await assert.rejects(()=>createAshykOnlineAdapter(clientFor(3)).getRoom('r1'),(error)=>error?.code==='ASHYK_PROTOCOL_LEGACY');
});
test('shot commit migration fixes deadline ownership and requires the committed shot id',()=>{
  const sql=read('supabase/migrations/20260924165000_alantil_16_8_ashyk_shot_commit.sql');
  for(const token of ['protocol_version set default 4','ashyk_shot_commit','shot_in_flight_id','shot_in_flight_actor_user_id','shot_in_flight_phase_seq','shot_result_deadline_at','ashyk_guard_committed_shot'])assert.match(sql,new RegExp(token));
  assert.match(sql,/interval '12 seconds'/);assert.match(sql,/greatest\(v_room\.phase_deadline_at,v_guard_deadline\)/);assert.match(sql,/new\.last_action_id is distinct from old\.shot_in_flight_id/);assert.match(sql,/protocol_version<4/);
});

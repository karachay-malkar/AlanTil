import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createAshykOnlineAdapter} from '../packages/ashyk-game/online.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file)=>fs.readFileSync(path.join(ROOT,file),'utf8');

test('online room contract has one active room and no protocol gate',()=>{
  const sql=read('supabase/migrations/20260925100000_alantil_16_8_ashyk_single_room_state.sql');
  assert.match(sql,/ashyk_rooms_single_active_guard/);
  assert.match(sql,/pg_advisory_xact_lock/);
  assert.match(sql,/r\.status in \('waiting','playing'\)/);
  assert.match(sql,/check\(status in \('waiting','playing','finished','abandoned'\)\)/);
  assert.match(sql,/update public\.ashyk_rooms\s+set status='waiting'[\s\S]*where status='preparing'/);
  assert.doesNotMatch(sql,/protocol_version<>4|protocol_version>=4|protocol_version<4/);
});

test('player snapshot exposes head-to-head score, status and one action column',()=>{
  const sql=read('supabase/migrations/20260925100000_alantil_16_8_ashyk_single_room_state.sql');
  for(const token of ["'wins'","'losses'","'game_status'","'action'","'incoming'","'outgoing'","'waiting'","'playing'","'busy'","'resume'","'challenge'"])assert.ok(sql.includes(token),token);
  assert.match(sql,/r\.winner_user_id=v_actor/);
  assert.match(sql,/r\.winner_user_id=f\.user_id/);
  const web=read('packages/ashyk-game/web/Game.jsx');
  for(const label of ['matchScore','statusColumn','actionColumn','incomingChallenge','outgoingChallenge','waitingForYou','gameRunning','playerBusy'])assert.ok(web.includes(label),label);
  assert.match(web,/ashykPlayerScore/);
  const css=read('src/features/ashyk/ashyk.css');
  assert.match(css,/ashykPlayerScore b\{color:var\(--success/);
  assert.match(css,/ashykPlayerScore em\{color:var\(--danger/);
});

test('friend mode is fixed at 20 seconds per shot and 10 seconds per answer',()=>{
  const constants=read('packages/ashyk-game/constants.js');
  const store=read('packages/ashyk-game/store.js');
  const sql=read('supabase/migrations/20260925100000_alantil_16_8_ashyk_single_room_state.sql');
  assert.match(constants,/ONLINE_RULES=Object\.freeze\(\{humanShotSeconds:20,humanQuestionSeconds:10\}\)/);
  assert.match(store,/state\.gameMode==='online'\?ONLINE_RULES/);
  assert.match(sql,/when p_phase='bonus-question' then 10 else 20 end/);
  assert.doesNotMatch(read('packages/ashyk-game/web/Game.jsx'),/m\.mediumWords/);
});

test('ordinary navigation never resigns an online game',()=>{
  const feature=read('src/features/ashyk/index.js');
  const bootstrap=read('src/app/bootstrap.js');
  assert.doesNotMatch(feature,/onLeave\(\)[\s\S]{0,220}leaveRoom/);
  assert.doesNotMatch(bootstrap,/leaveRoom\(resumable\.id\)/);
  assert.match(feature,/Active online rooms survive and are resumable/);
});

test('build freshness check stores the requested online action and reloads silently',()=>{
  const handoff=read('src/shared/social/ashyk-handoff.js');
  assert.match(handoff,/fetch\(\`\/index\.html\?__alantil_build_check=/);
  assert.match(handoff,/cache:'no-store'/);
  assert.match(handoff,/setPendingAshykIntent\(intent\)/);
  assert.match(handoff,/window\.location\.reload\(\)/);
  assert.doesNotMatch(handoff,/protocol_version|incompatible protocol/i);
});

test('adapter fetches one server-composed player snapshot and listens to room/invite changes',async()=>{
  const calls=[];
  const channel={on(){return this;},subscribe(){return this;},unsubscribe(){}};
  const client={rpc:async(name,args)=>{calls.push([name,args]);return{data:name==='ashyk_players_snapshot'?[{user_id:'u2',wins:3,losses:1,game_status:'none',action:'challenge'}]:null,error:null};},channel:()=>channel,removeChannel(){}};
  const online=createAshykOnlineAdapter(client);
  const rows=await online.getPlayersSnapshot();
  assert.equal(rows.length,1);
  assert.equal(rows[0].wins,3);
  assert.equal(calls[0][0],'ashyk_players_snapshot');
  assert.equal(typeof online.subscribePlayerUpdates,'function');
});

test('web build is bumped as one cache generation',()=>{
  assert.match(read('index.html'),/name="alantil-build" content="16\.8\.0\.5"/);
  assert.match(read('service-worker.js'),/const VERSION = "16\.8\.0\.5"/);
  assert.match(read('packages/alantil-core/release.js'),/16\.8\.0\.5/);
});

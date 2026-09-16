import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dictionaryRatingWeight, masteryRatingWeight, ratingPointsForWord, ratingScoreForWords } from '../packages/alantil-core/rating.js';
import { createAshykGameStore } from '../packages/ashyk-game/store.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(p)=>fs.readFileSync(path.join(ROOT,p),'utf8');

test('rating uses fixed dictionary and mastery weights',()=>{
  assert.equal(dictionaryRatingWeight('beginner'),1);
  assert.equal(dictionaryRatingWeight('intermediate'),2);
  assert.equal(dictionaryRatingWeight('advanced'),3);
  assert.equal(dictionaryRatingWeight('family'),1.5);
  assert.equal(masteryRatingWeight(79),0);
  assert.equal(masteryRatingWeight(80),1);
  assert.equal(masteryRatingWeight(90),1.5);
  assert.equal(masteryRatingWeight(100),2);
  assert.equal(ratingPointsForWord({dictionaryId:'advanced',masteryPercent:100}),6);
});

test('rating counts a word once using its highest dictionary weight',()=>{
  const score=ratingScoreForWords([
    {wordId:'w1',dictionaryId:'beginner',masteryPercent:100},
    {wordId:'w1',dictionaryId:'advanced',masteryPercent:100},
    {wordId:'w2',dictionaryId:'family',masteryPercent:90},
  ]);
  assert.equal(score,8.25);
});

test('local duet keeps both active players local and never schedules AI',()=>{
  const engine={reset(){},clearSelection(){}};
  const store=createAshykGameStore({engine,words:[],setTimer:()=>99,clearTimer(){},setRepeater:()=>0,clearRepeater(){}});
  store.setMode('local');
  store.startLocal('normal');
  assert.equal(store.getState().gameMode,'local');
  assert.equal(store.isLocalTurn(),true);
  store.startTurn(2);
  assert.equal(store.isLocalTurn(),true);
  assert.equal(store.isComputerTurn(),false);
  store.destroy();
});

test('friend online adapter contains no room-code flow',()=>{
  const online=read('packages/ashyk-game/online.js');
  assert.match(online,/createFriendInvite/);
  assert.match(online,/acceptInvite/);
  assert.match(online,/subscribeInvites/);
  assert.doesNotMatch(online,/ashyk_join_room/);
  assert.doesNotMatch(online,/cleanCode/);
});

test('social SQL exposes safe RPCs and removes room codes',()=>{
  const sql=read('supabase/migrations/20260916_alantil_16_7_social_friends_rating_ashyk.sql');
  for(const name of ['social_search_users','social_leaderboard','social_friends_snapshot','social_send_friend_request','social_accept_friend_request','social_block_user','social_inbox_counts','ashyk_invite_create','ashyk_invite_accept'])assert.match(sql,new RegExp(`function public\\.${name}`));
  assert.match(sql,/drop column if exists code/);
  assert.match(sql,/drop function if exists public\.ashyk_join_room/);
  assert.doesNotMatch(sql,/email/);
});

test('web and mobile register Friends as fourth root tab',()=>{
  const app=read('mobile/AppRoot.js'),html=read('index.html'),router=read('src/app/router.js'),registry=read('src/app/screen-registry.js');
  assert.match(app,/friends/);
  assert.match(html,/data-route="friends\.home"/);
  assert.match(router,/friends\.home/);
  assert.match(registry,/"friends\.home"/);
});

test('Ashyk setup no longer exposes a room code',()=>{
  const web=read('packages/ashyk-game/web/Game.jsx'),mobile=read('mobile/screens/ashyk.js');
  assert.doesNotMatch(web,/roomCode|createRoom|joinRoom/);
  assert.doesNotMatch(mobile,/roomCode|createRoom|joinRoom/);
  assert.match(web,/startLocal/);
  assert.match(mobile,/startLocal/);
});

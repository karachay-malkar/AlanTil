import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dictionaryRatingWeight, masteryRatingWeight, ratingPointsForWord, ratingScoreForWords } from '../packages/alantil-core/rating.js';
import { createAshykGameStore } from '../packages/ashyk-game/store.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(p)=>fs.readFileSync(path.join(ROOT,p),'utf8');
const socialSql=[
  'supabase/migrations/20260916170000_alantil_16_7_social_core.sql',
  'supabase/migrations/20260916170100_alantil_16_7_ashyk_invites.sql',
  'supabase/migrations/20260916170200_alantil_16_7_social_rpc.sql',
  'supabase/migrations/20260916170300_alantil_16_7_social_snapshot.sql',
  'supabase/migrations/20260916170400_alantil_16_7_progress_sync.sql',
].map(read).join('\n');

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

test('mastery percent is part of local progress, cloud pull and snapshot merge',()=>{
  const core=read('packages/alantil-core/word-progress.js');
  const cloud=read('mobile/platform/cloud-sync.js');
  const sync=read('supabase/migrations/20260916170400_alantil_16_7_progress_sync.sql');
  assert.match(core,/['"]mastery_percent['"]/);
  assert.match(cloud,/select=[^'\"]*mastery_percent/);
  assert.match(sync,/mastery_percent/);
  assert.match(sync,/greatest\(public\.user_word_progress\.mastery_percent, excluded\.mastery_percent\)/);
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

test('social SQL exposes safe RPCs, invite lifecycle and no room-code entry point',()=>{
  for(const name of ['social_search_users','social_leaderboard','social_friends_snapshot','social_send_friend_request','social_accept_friend_request','social_block_user','social_inbox_counts','ashyk_invite_create','ashyk_invite_accept'])assert.match(socialSql,new RegExp(`function public\\.${name}`));
  assert.match(socialSql,/drop column if exists code/i);
  assert.match(socialSql,/drop function if exists public\.ashyk_join_room/i);
  assert.doesNotMatch(socialSql,/select\s+[^;]*email/i);
});

test('web and mobile register Friends as fourth root tab with inbox badge',()=>{
  const app=read('mobile/AppRoot.js'),html=read('index.html'),router=read('src/app/router.js'),registry=read('src/app/screen-registry.js'),bootstrap=read('src/app/bootstrap.js');
  assert.match(app,/SocialBottomNav/);
  assert.match(app,/socialBadge/);
  assert.match(html,/data-route="friends\.home"/);
  assert.match(html,/data-friends-badge/);
  assert.match(router,/friends\.home/);
  assert.match(registry,/"friends\.home"/);
  assert.match(bootstrap,/startSocialInboxController/);
  assert.match(bootstrap,/data-friends-badge/);
});

test('Friends guest and blocked copy use dedicated social labels on both platforms',()=>{
  const web=read('src/features/friends/index.js'),mobile=read('mobile/screens/friends.js');
  for(const source of [web,mobile]){
    assert.match(source,/signInAction/);
    assert.match(source,/blocked/);
  }
});

test('Ashyk setup exposes computer, local and friend modes without room codes',()=>{
  const web=read('packages/ashyk-game/web/Game.jsx'),mobile=read('mobile/screens/ashyk.js');
  for(const source of [web,mobile]){
    assert.doesNotMatch(source,/roomCode|createRoom|joinRoom/);
    assert.match(source,/startLocal/);
    assert.match(source,/createFriendInvite/);
  }
  assert.doesNotMatch(mobile,/!userId&&state\.gameMode!==['"]computer['"]/);
});

test('social copy includes local winner and explicit sign-in action',()=>{
  const copy=read('packages/alantil-core/social-i18n.js');
  assert.match(copy,/playerWon:/);
  assert.match(copy,/signInAction:/);
});

test('16.7.0 mobile version uses build 40',()=>{
  const app=JSON.parse(read('mobile/app.json')).expo;
  const pkg=JSON.parse(read('mobile/package.json'));
  assert.equal(app.version,'16.7.0');
  assert.equal(app.extra.releaseVersion,'16.7.0');
  assert.equal(app.android.versionCode,40);
  assert.equal(app.ios.buildNumber,'40');
  assert.equal(pkg.version,'16.7.0');
});

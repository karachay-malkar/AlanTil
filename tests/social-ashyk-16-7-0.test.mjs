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
  'supabase/migrations/20260916170500_alantil_16_7_mastery_percent_monotonic.sql',
  'supabase/migrations/20260916170600_alantil_16_7_social_performance_hardening.sql',
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

test('database mastery guard never lowers a previously earned sign',()=>{
  const monotonic=read('supabase/migrations/20260916170500_alantil_16_7_mastery_percent_monotonic.sql');
  assert.match(monotonic,/v_previous:=coalesce\(old\.mastery_percent,0\)/);
  assert.match(monotonic,/greatest\([\s\S]*v_previous/);
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

test('search and leaderboard expose friendship id so incoming requests are actionable',()=>{
  const rpc=read('supabase/migrations/20260916170200_alantil_16_7_social_rpc.sql');
  const web=read('src/features/friends/index.js');
  const mobile=read('mobile/screens/friends.js');
  assert.match(rpc,/friendship_id/);
  assert.match(web,/user\.friendship_id/);
  assert.doesNotMatch(web,/social-accept-user/);
  assert.match(mobile,/user\.friendship_id/);
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

test('Ashyk guests see only computer while registered users also get local and friend modes',()=>{
  const web=read('packages/ashyk-game/web/Game.jsx'),mobile=read('mobile/screens/ashyk.js');
  for(const source of [web,mobile]){
    assert.doesNotMatch(source,/roomCode|createRoom|joinRoom/);
    assert.match(source,/startLocal/);
    assert.match(source,/createFriendInvite/);
    assert.match(source,/const modes=\[\["computer",sm\('computer'\)\],\.\.\.\(userId\?\[\["local",sm\('local'\)\],\["online",sm\('friend'\)\]\]:\[\]\)\]/);
    assert.match(source,/loginForModes/);
  }
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

test('Friends uses shared profile bracket tabs without pill layout or duplicate title',()=>{
  const web=read('src/features/friends/index.js');
  const css=read('src/features/friends/friends-16-7.css');
  const profileNav=read('src/shared/ui/profile-navigation.js');
  const mobile=read('mobile/screens/friends.js');
  const mobileProfile=read('mobile/screens/profile-main.js');
  assert.doesNotMatch(web,/settingsSegments/);
  assert.doesNotMatch(web,/<h1\b/i);
  assert.match(profileNav,/export function renderBracketTabs/);
  assert.match(web,/renderBracketTabs/);
  assert.match(css,/grid-template-rows:auto minmax\(0,1fr\)/);
  assert.match(css,/\.socialBody\{[^}]*min-height:0[^}]*overflow:auto/s);
  assert.doesNotMatch(css,/\.socialTabs\{[^}]*border-radius:999px/s);
  assert.match(mobile,/ProfileTabs/);
  assert.match(mobileProfile,/ProfileTabs/);
  assert.doesNotMatch(mobile,/style=\{s\.title\}/);
  assert.doesNotMatch(mobile,/borderRadius:999/);
});

test('activity_access becomes reactive on Web and waits for native auth on Mobile',()=>{
  const web=read('src/features/friends/index.js');
  const access=read('src/shared/admin/admin-access.js');
  const nativeAdmin=read('mobile/platform/admin.js');
  const mobile=read('mobile/screens/friends.js');
  const combined=`${web}\n${access}\n${nativeAdmin}\n${mobile}`;
  assert.match(web,/alantil:activity-access/);
  assert.match(web,/whenActivityAccessReady/);
  assert.match(access,/if\s*\(!authState\?\.ready\)\s*return currentAccess/);
  assert.match(nativeAdmin,/bootstrapNativeAuth/);
  assert.match(nativeAdmin,/expectedUserId/);
  assert.match(mobile,/fetchNativeActivityAccess\(userId\)/);
  assert.doesNotMatch(combined,/Taulu07/i);
  assert.doesNotMatch(combined,/nickname[^\n]{0,80}activity_access|activity_access[^\n]{0,80}nickname/i);
});

test('Google OAuth cold start waits for the callback and clears it only after success',()=>{
  const auth=read('src/shared/auth/auth-service.js');
  const bootstrap=read('src/app/bootstrap.js');
  assert.match(auth,/export async function initializeAuth\(\)\s*\{\s*return startAuthInitialization\(\);\s*\}/);
  assert.equal((auth.match(/exchangeCodeForSession\(/g)||[]).length,1);
  assert.equal((auth.match(/clearCallbackUrl\(\);/g)||[]).length,1);
  assert.match(auth,/locationObject\.hash/);
  assert.match(auth,/callbackParams\(locationObject = window\.location\)/);
  assert.match(bootstrap,/if \(callbackVisit\) await authInitialization/);
});

test('Friends and Admin routes remain registered and Admin stays guarded',()=>{
  const router=read('src/app/router.js');
  assert.match(router,/friends\.home/);
  assert.match(router,/admin\.users/);
  assert.match(router,/guardAdminTarget/);
  assert.match(router,/target\.route\.startsWith\("admin\."\)/);
  assert.match(router,/whenActivityAccessReady/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dictionaryRatingWeight, masteryRatingWeight, ratingPointsForWord, ratingScoreForWords } from '../packages/alantil-core/rating.js';
import { createAshykGameStore } from '../packages/ashyk-game/store.js';
import { ASHYK_FEATURE_FLAGS, ashykAccessForUser } from '../packages/alantil-core/ashyk-access.js';

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
  'supabase/migrations/20260919083923_alantil_16_7_ashyk_lobby_resilience.sql',
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

test('same-device Ashyk code remains present but is disabled by the shared feature flag',()=>{
  const engine={reset(){},clearSelection(){}};
  const store=createAshykGameStore({engine,words:[],setTimer:()=>99,clearTimer(){},setRepeater:()=>0,clearRepeater(){}});
  assert.equal(ASHYK_FEATURE_FLAGS.allowLocalSameDevice,false);
  store.setMode('local');
  assert.equal(store.getState().gameMode,'computer');
  assert.equal(store.startLocal('normal'),false);
  assert.equal(store.getState().status,'setup');
  assert.match(read('packages/ashyk-game/store.js'),/function startLocal/);
  store.destroy();
});

test('friend online adapter contains no room-code flow',()=>{
  const online=read('packages/ashyk-game/online.js');
  assert.match(online,/createFriendInvite/);
  assert.match(online,/acceptInvite/);
  assert.match(online,/getActiveRoom/);
  assert.match(online,/markReady/);
  assert.match(online,/pingRoom/);
  assert.match(online,/subscribeInvites/);
  assert.match(online,/status==='SUBSCRIBED'/);
  assert.doesNotMatch(online,/ashyk_join_room/);
  assert.doesNotMatch(online,/cleanCode/);
});

test('social SQL exposes safe RPCs, invite lifecycle and no room-code entry point',()=>{
  for(const name of ['social_search_users','social_leaderboard','social_friends_snapshot','social_send_friend_request','social_accept_friend_request','social_block_user','social_inbox_counts','ashyk_invite_create','ashyk_invite_accept','ashyk_room_get','ashyk_active_room','ashyk_room_ready','ashyk_room_ping'])assert.match(socialSql,new RegExp(`function public\\.${name}`));
  assert.match(socialSql,/drop column if exists code/i);
  assert.match(socialSql,/drop function if exists public\.ashyk_join_room/i);
  assert.doesNotMatch(socialSql,/select\s+[^;]*email/i);
});

test('Ashyk lobby waits for both clients, keeps heartbeat and uses PostgREST-compatible RPC args',()=>{
  const sql=read('supabase/migrations/20260919083923_alantil_16_7_ashyk_lobby_resilience.sql');
  const online=read('packages/ashyk-game/online.js');
  assert.match(sql,/status='preparing'/);
  assert.match(sql,/host_ready_at/);
  assert.match(sql,/guest_ready_at/);
  assert.match(sql,/host_seen_at/);
  assert.match(sql,/guest_seen_at/);
  assert.match(sql,/create function public\.ashyk_submit_state\(\s*p_room_id uuid,\s*p_expected_revision bigint,\s*p_state jsonb,\s*p_next_active_user_id uuid/s);
  assert.match(sql,/create function public\.ashyk_leave_room\(p_room_id uuid\)/);
  assert.match(online,/p_room_id:room\.id/);
  assert.match(online,/p_expected_revision:Number\(room\.revision\|\|0\)/);
});

test('Ashyk uses global challenge/resume and does not abandon rooms on technical unmount',()=>{
  const bootstrap=read('src/app/bootstrap.js'),app=read('mobile/AppRoot.js'),web=read('packages/ashyk-game/web/Game.jsx'),mobile=read('mobile/screens/ashyk.js'),feature=read('src/features/ashyk/index.js');
  assert.match(bootstrap,/showGlobalAshykState/);
  assert.match(bootstrap,/returnToGame/);
  assert.match(app,/AshykGlobalPrompt/);
  assert.match(app,/resumeAshykRoom/);
  assert.match(feature,/getActiveRoom/);
  assert.match(web,/setInterval\(\(\)=>void pulse\(\),12000\)/);
  assert.match(mobile,/setInterval\(\(\)=>void pulse\(\),12000\)/);
  assert.match(web,/opponentAwayMs>120000/);
  assert.match(mobile,/opponentAwayMs>120000/);
  assert.doesNotMatch(web,/return\(\)=>\{[^}]*leaveRoom/s);
  assert.doesNotMatch(mobile,/useEffect\(\(\)=>\(\)=>\{[^}]*leaveRoom/s);
});

test('Ashyk settles the opening field before creating a network invite',()=>{
  const engine=read('packages/ashyk-game/engine.js'),web=read('packages/ashyk-game/web/Game.jsx'),mobile=read('mobile/screens/ashyk.js');
  assert.match(engine,/function settleInitial/);
  assert.match(engine,/eventsSuppressed/);
  assert.match(web,/engine\.settleInitial\(\)/);
  assert.match(mobile,/engine\.settleInitial\(\)/);
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

test('web and mobile register Community as the fourth root tab while Friends stays an inner tab',()=>{
  const app=read('mobile/AppRoot.js'),html=read('index.html'),router=read('src/app/router.js'),registry=read('src/app/screen-registry.js'),bootstrap=read('src/app/bootstrap.js'),copy=read('packages/alantil-core/social-i18n.js');
  assert.match(app,/SocialBottomNav/);
  assert.match(app,/socialBadge/);
  assert.match(app,/socialMessage\(language,'community'\)/);
  assert.match(html,/data-route="friends\.home"/);
  assert.match(html,/data-friends-badge/);
  assert.match(html,/>Сообщество<\/span>/);
  assert.match(router,/friends\.home/);
  assert.match(registry,/"friends\.home"/);
  assert.match(bootstrap,/startSocialInboxController/);
  assert.match(bootstrap,/data-friends-badge/);
  assert.match(bootstrap,/socialMessage\(getInterfaceLanguage\(\),'community'\)/);
  assert.match(bootstrap,/alantil-core\/social-i18n\.js\?v=16\.7\.0\.2/);
  assert.match(read('src/features/friends/index.js'),/alantil-core\/social-i18n\.js\?v=16\.7\.0\.2/);
  assert.match(copy,/community:M\('Сообщество','Community','Topluluk'\)/);
  assert.match(copy,/friends:M\('Друзья','Friends','Arkadaşlar'\)/);
});

test('Friends guest and blocked copy use dedicated social labels on both platforms',()=>{
  const web=read('src/features/friends/index.js'),mobile=read('mobile/screens/friends.js');
  for(const source of [web,mobile]){
    assert.match(source,/signInAction/);
    assert.match(source,/blocked/);
  }
});

test('Ashyk guests are locked while registered users get computer and online friend modes only',()=>{
  const guest=ashykAccessForUser(''),account=ashykAccessForUser('user-1');
  assert.equal(ASHYK_FEATURE_FLAGS.allowGuests,false);
  assert.equal(ASHYK_FEATURE_FLAGS.allowComputer,true);
  assert.equal(ASHYK_FEATURE_FLAGS.allowOnlineFriend,true);
  assert.equal(ASHYK_FEATURE_FLAGS.allowLocalSameDevice,false);
  assert.equal(guest.locked,true);
  assert.deepEqual(guest.modes,[]);
  assert.equal(account.locked,false);
  assert.deepEqual(account.modes,['computer','online']);
  const web=read('packages/ashyk-game/web/Game.jsx'),mobile=read('mobile/screens/ashyk.js');
  for(const source of [web,mobile]){
    assert.match(source,/ashykAccessForUser\(userId\)\.modes/);
    assert.match(source,/startLocal/);
    assert.match(source,/createFriendInvite/);
    assert.doesNotMatch(source,/const modes=\[\["computer"[\s\S]{0,160}\["local"/);
  }
});

test('Ashyk guest lock covers direct Web/Mobile entry and global challenge actions',()=>{
  const feature=read('src/features/ashyk/index.js'),mobile=read('mobile/screens/ashyk.js'),app=read('mobile/AppRoot.js'),bootstrap=read('src/app/bootstrap.js');
  assert.match(feature,/ashykAccessForUser\(userId\)/);
  assert.match(feature,/data-ashyk-sign-in/);
  assert.match(feature,/router\.navigate\('account\.home'\)/);
  assert.match(mobile,/if\(access\.locked\)return/);
  assert.match(mobile,/ashykRegisteredOnly/);
  assert.match(app,/onSignIn=\{\(\)=>\{setIncomingAshykRoom\(null\);setTab\('profile'\);setScreen\('account'\);\}\}/);
  assert.match(bootstrap,/ashykAccessForUser\(userId\)\.locked/);
});

test('extended statistics exposes the same guest analytics contract on Web and Mobile',()=>{
  const web=read('src/features/admin/index.js'),native=read('mobile/screens/admin-users.js'),webService=read('src/shared/admin/admin-activity-service.js'),nativeService=read('mobile/platform/admin.js');
  for(const source of [web,native]){assert.match(source,/statsUsers/);assert.match(source,/statsGuests/);assert.match(source,/guestUniqueVisitors/);assert.match(source,/guestSources/);assert.match(source,/guestPlatforms/);assert.match(source,/guestEntryPaths/);}
  assert.match(webService,/admin_guest_analytics/);
  assert.match(nativeService,/admin_guest_analytics/);
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

test('Friends uses the same floating bracket-tab chrome as Profile without a solid header strip',()=>{
  const web=read('src/features/friends/index.js');
  const css=read('src/features/friends/friends-16-7.css');
  const chrome=read('src/shared/styles/chrome.css');
  const profileNav=read('src/shared/ui/profile-navigation.js');
  const mobile=read('mobile/screens/friends.js');
  const mobileProfile=read('mobile/screens/profile-main.js');
  assert.doesNotMatch(web,/<h1\b/i);
  assert.match(profileNav,/export function renderBracketTabs/);
  assert.match(web,/renderBracketTabs/);
  assert.match(css,/\.socialBody\{[^}]*position:absolute[^}]*overflow:auto/s);
  assert.match(chrome,/\[data-feature="friends"\] \.socialHeader\{/);
  assert.match(chrome,/background:transparent!important/);
  assert.doesNotMatch(css,/\.socialTabs\{[^}]*border-radius:999px/s);
  assert.match(mobile,/ProfileTabs/);
  assert.match(mobile,/topChromeDepth=\{theme\.chrome\.screenDepths\.friends\.top\}/);
  assert.match(mobile,/tabs:\{position:'absolute'/);
  assert.match(mobileProfile,/tabs:\{position:'absolute'/);
  assert.doesNotMatch(mobile,/style=\{s\.title\}/);
});

test('Extended statistics tab is absent on Web and Mobile until activity_access is allowed',()=>{
  const web=read('src/features/friends/index.js');
  const mobile=read('mobile/screens/friends.js');
  assert.match(web,/statsAccessState==='allowed'\?\[\{id:'stats'/);
  assert.match(mobile,/accessState==='allowed'\?\[\['stats',t\('extendedStats'\)\]\]:\[\]/);
  assert.match(mobile,/visibleMode=mode==='stats'&&accessState!=='allowed'\?'rating':mode/);
  assert.match(mobile,/if\(id==='stats'&&accessState!=='allowed'\)/);
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

test('Community statistics is a root route while only user/test detail routes stay Admin guarded',()=>{
  const router=read('src/app/router.js');
  const registry=read('src/app/screen-registry.js');
  assert.match(router,/if \(second === "statistics"\) \{\s*if \(!third\) return \{ route: "friends\.home", params: \{ mode: "stats" \} \}/);
  assert.match(router,/admin\.user/);
  assert.match(router,/admin\.test/);
  assert.match(router,/target\.route === "admin\.users"/);
  assert.match(router,/target\.route\.startsWith\("admin\."\)/);
  assert.match(router,/whenActivityAccessReady/);
  assert.match(registry,/"friends\.home": \{ layout: "root", header: "minimal", bottomNav: true/);
});


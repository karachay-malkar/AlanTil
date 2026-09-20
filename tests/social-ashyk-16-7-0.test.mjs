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

test('Ashyk online sync persists bonus-question phase instead of resetting it',()=>{const store=read('packages/ashyk-game/store.js'),web=read('packages/ashyk-game/web/Game.jsx'),mobile=read('mobile/screens/ashyk.js');assert.match(store,/phase:state\.phase/);assert.match(store,/question:state\.question/);assert.match(store,/phase=stateData\.phase==='bonus-question'/);for(const source of[web,mobile]){assert.match(source,/state\.phase==='bonus-question'/);assert.match(source,/state\.scores\[0\]/);assert.match(source,/state\.scores\[1\]/);assert.doesNotMatch(source,/state\.scores,state\.remainingAshyks/);}});

test('Web Ashyk requires the complete dictionary and never mounts from the starter snapshot',()=>{
  const feature=read('src/features/ashyk/index.js'),repository=read('src/shared/data/word-repository.js');
  assert.match(feature,/getCompleteDictionaryWords/);
  assert.match(feature,/loadAshykWords\(controller\.signal\)/);
  assert.match(feature,/createAshykQuestionDeck/);
  assert.match(feature,/refreshDictionary\(\{signal,force:true\}\)/);
  assert.doesNotMatch(feature,/getWords\(\)\.catch\(\(\)=>\[\]\)/);
  const start=repository.indexOf('export async function getCompleteDictionaryWords');
  const end=repository.indexOf('export function getCachedWords',start);
  const block=repository.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.match(block,/loadLocalSnapshot\(\{ signal, includeBundled: true \}\)/);
  assert.match(block,/source !== "starter"/);
  assert.match(block,/downloadDictionary\("", \{ signal \}\)/);
  assert.doesNotMatch(block,/installSnapshot\(readStarterDictionary\(\)\)/);
});

test('bundled mobile dictionary contains the complete Ashyk Return-to-roots source',()=>{
  const snapshot=JSON.parse(read('mobile/data/dictionary-snapshot.json'));
  const roots=(snapshot.words||[]).filter((word)=>String(word.dictionary_id||'')==='intermediate'&&String(word.story_id||'')==='roots');
  const counts=roots.reduce((map,word)=>{const pos=String(word.pos||'').trim().toLowerCase();map[pos]=(map[pos]||0)+1;return map;},{});
  assert.equal(roots.length,751);
  assert.deepEqual(counts,{noun:386,adj:148,verb:199,adv:18});
});

test('Ashyk result and vocabulary-question UI match the requested compact layout',()=>{
  const web=read('packages/ashyk-game/web/Game.jsx'),mobile=read('mobile/screens/ashyk.js'),copy=read('packages/ashyk-game/i18n.js'),css=read('src/features/ashyk/ashyk-16-7.css');
  assert.doesNotMatch(web,/<p>\{m\.finalField\}<\/p>/);
  assert.doesNotMatch(mobile,/styles\.finishNotice/);
  assert.match(web,/ashykSecondary ashykQuestionAction/);
  assert.match(web,/ashykPrimary ashykQuestionAction/);
  assert.match(mobile,/role="generic\.default"/);
  assert.match(mobile,/role="test\.submit"/);
  assert.match(copy,/skip:'Пропуск'/);
  assert.ok(copy.includes("questionRule:'Верно → +3 очка и ещё 1 удар\\nНеверно → −1 балл\\nПропуск → без штрафа'"));
  assert.match(css,/white-space:pre-line/);
});

test('Web startup uses IndexedDB and the bundled full dictionary before network refresh',()=>{
  const repository=read('src/shared/data/word-repository.js'),store=read('src/shared/data/dictionary-store.js');
  assert.match(store,/indexedDB\.open/);
  assert.match(store,/DICTIONARY_STORE_SCHEMA_VERSION/);
  assert.match(repository,/readDictionarySnapshot/);
  assert.match(repository,/writeDictionarySnapshot/);
  assert.match(repository,/dictionary-snapshot\.json/);
  assert.match(repository,/setTimeout\(run, 900\)/);
  assert.doesNotMatch(repository,/const local = cached \|\| readStarterDictionary\(\)/);
});

test('Path waits for the complete local dictionary and patches cloud progress without rebuilding the map',()=>{
  const feature=read('src/features/path/feature.js'),bootstrap=read('src/app/bootstrap.js');
  assert.match(feature,/getCompleteDictionaryWords/);
  assert.doesNotMatch(feature,/const words=await getWords\(\)/);
  assert.match(feature,/refreshRouteProgressInPlace/);
  assert.doesNotMatch(feature,/document\.fonts\?\.ready/);
  assert.match(bootstrap,/if \(route === "path\.home"\) return;/);
  assert.match(bootstrap,/if \(router\.getCurrent\(\)\.route === "path\.home"\) return;/);
});

test('Service worker serves versioned application code cache-first and Router owns lazy CSS loading',()=>{
  const sw=read('service-worker.js'),css=read('src/shared/styles/app.css'),router=read('src/app/router.js'),bootstrap=read('src/app/bootstrap.js'),ashykFeature=read('src/features/ashyk/index.js');
  assert.ok(sw.includes('const VERSION = "16.7.0.9";'));
  assert.ok(sw.includes('url.searchParams.has("v") ? cacheFirst(request)'));
  assert.equal(sw.includes('cache: "no-store"'),false);
  assert.match(sw,/navigationResponse/);
  for(const eager of ['features/learn/learn.css','features/test/test.css','features/match/match.css','features/practice/practice.css','features/friends/friends-16-7.css','features/profile/profile.css','features/admin/admin.css','features/account/account.css','features/settings/settings.css','features/songs/songs.css','features/ashyk/ashyk.css'])assert.equal(css.includes(eager),false);
  assert.ok(css.includes('profile-tabs.css?v=16.7.0.9'));
  for(const token of ['STYLE_PATHS','screenStyleDependencies','ensureRouteStyles','prepareRoute'])assert.ok(router.includes(token));
  assert.equal(router.includes('FEATURE_STYLES'),false);
  assert.equal(router.includes('ensureFeatureStyles'),false);
  assert.equal(bootstrap.includes('ensureStyle'),false);
  for(const feature of ['src/features/test/index.js','src/features/match/index.js','src/features/account/index.js'])assert.equal(read(feature).includes('context.ensureStyle'),false);
  for(const wrapper of ['practice','friends','profile','admin','learn','test','match','songs','account','settings']){
    const lazy=read('src/shared/styles/lazy/'+wrapper+'.css');
    assert.ok(lazy.trim().startsWith('@import url("'));
    assert.equal((lazy.match(/layer\(features\)/g)||[]).length,1);
  }
  const ashykCss=read('src/shared/styles/lazy/ashyk.css');
  assert.ok(ashykCss.includes('ashyk/ashyk.css'));
  assert.ok(ashykCss.includes('ashyk/ashyk-16-7.css'));
  assert.equal((ashykCss.match(/layer\(features\)/g)||[]).length,2);
  assert.equal(ashykFeature.includes('function ensureStyles'),false);
  assert.equal(ashykFeature.includes('data.ashykUi'),false);
  assert.equal(ashykFeature.includes('styleLink'),false);
});

test('screen registry declares the complete CSS dependency set for every route',()=>{
  const registry=read('src/app/screen-registry.js');
  const expected={
    'path.home':[],'path.story-words':[],'path.station':[],'path.study':['learn'],'path.test':['test'],
    'practice.home':['practice'],'practice.ashyk':['ashyk'],'friends.home':['friends','admin'],
    'profile.home':['profile'],'profile.skills':['profile'],'profile.statistics':['profile'],
    'admin.users':['admin'],'admin.user':['admin'],'admin.test':['admin'],
    'learn.catalog':['learn'],'learn.catalog-content':['learn'],'learn.sections':['learn'],'learn.set':['learn'],'learn.study':['learn'],'learn.results':['learn'],
    'test.menu':['test'],'test.session':['test'],'test.results':['test'],
    'match.menu':['test','match'],'match.game':['test','match'],'match.results':['test','match'],
    'songs.playlists':['songs'],'songs.catalog':['songs'],'songs.song':['songs'],
    'account.home':['account'],
    'settings.home':['settings'],'settings.privacy':['settings'],'settings.version':['settings'],'settings.thanks':['settings'],
  };
  assert.ok(registry.includes('export function screenStyleDependencies'));
  for(const [route,styles] of Object.entries(expected)){
    const routeStart=registry.indexOf('"'+route+'": {');
    assert.notEqual(routeStart,-1,'missing screen registry entry for '+route);
    const lineEnd=registry.indexOf('\n',routeStart);
    const line=registry.slice(routeStart,lineEnd<0?registry.length:lineEnd);
    const styleLiteral='styles: ['+styles.map((style)=>'"'+style+'"').join(', ')+']';
    assert.ok(line.includes(styleLiteral),'wrong style dependencies for '+route);
  }
  const appCss=read('src/shared/styles/app.css');
  for(const pathStyle of ['features/path/path.css','features/path/story-word-list.css','features/path/story-stele.css','features/path/path-navigation.css'])assert.ok(appCss.includes(pathStyle));
});

test('bracket tabs use one shared visual source outside Profile feature CSS',()=>{
  const appCss=read('src/shared/styles/app.css'),shared=read('src/shared/styles/profile-tabs.css'),profile=read('src/features/profile/profile.css');
  assert.ok(appCss.includes('profile-tabs.css'));
  for(const token of ['.profilePrimaryNav{','.profilePrimaryTab{','appearance:none','color:var(--text-3)','font-family:var(--font-terminal)','.profilePrimaryTab.active{'])assert.ok(shared.includes(token));
  assert.equal(profile.includes('.profilePrimaryNav{'),false);
  assert.equal(profile.includes('.profilePrimaryTab{'),false);
});

test('Web and Mobile ship the same complete dictionary snapshot',()=>{
  const web=JSON.parse(read('src/data/dictionary-snapshot.json')),mobile=JSON.parse(read('mobile/data/dictionary-snapshot.json'));
  assert.equal(web.version,mobile.version);
  assert.equal(web.words.length,2976);
  assert.equal(web.words.length,mobile.words.length);
  assert.equal(web.stories.length,mobile.stories.length);
});

test('Ashyk board renders a wood fallback before async PBR textures are ready',()=>{
  const wood=read('packages/ashyk-game/model/wood-board.js'),scene=read('packages/ashyk-game/web/scene.jsx'),feature=read('src/features/ashyk/index.js');
  assert.match(wood,/ASHYK_WOOD_FALLBACK_COLORS/);
  assert.match(wood,/loadAshykWoodPbrTexturesAsync/);
  assert.match(wood,/Promise\.allSettled/);
  assert.match(wood,/hydrateAshykBoardVisual/);
  assert.match(wood,/ashykWoodDisposed/);
  const createStart=wood.indexOf('export function createAshykBoardVisual');
  const hydrateStart=wood.indexOf('export async function hydrateAshykBoardVisual',createStart);
  const createBlock=wood.slice(createStart,hydrateStart);
  assert.doesNotMatch(createBlock,/loadAshykWoodPbrTextures\(THREE\)/);
  assert.match(createBlock,/ASHYK_WOOD_FALLBACK_COLORS\.top/);
  assert.match(scene,/void hydrateAshykBoardVisual\(THREE,board\)/);
  assert.match(scene,/Ashyk board PBR load failed/);
  assert.match(feature,/runtime\.js\?v=16\.7\.0\.8/);
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


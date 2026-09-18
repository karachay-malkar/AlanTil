import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {UI_TOKENS,VISUAL_CONTRACT_VERSION,WEB_VISUAL_REFERENCE} from '../packages/alantil-ui/tokens.js';
import {CHROME_CONTRACT} from '../packages/alantil-ui/chrome.js';
import {LIST_TABLE_CONTRACT,listRowHeight} from '../packages/alantil-ui/list-table.js';
import {CONTROL_LAYOUT} from '../packages/alantil-ui/control-layout.js';
import {SCREEN_VISUAL_BINDINGS} from '../packages/alantil-ui/screen-bindings.js';
import {WEB_VISUAL_SOURCES,verifyWebVisualSourceManifest} from '../mobile/ui/web-visual-source.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file)=>fs.readFileSync(path.join(ROOT,file),'utf8');
const blobSha=(file)=>{const content=fs.readFileSync(path.join(ROOT,file));return crypto.createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');};

test('16.7 shared LIST_TABLE_CONTRACT is the canonical list geometry',()=>{
  assert.equal(VISUAL_CONTRACT_VERSION,'16.7.0');
  assert.equal(WEB_VISUAL_REFERENCE,'16.7.0');
  assert.deepEqual(LIST_TABLE_CONTRACT.standard,{small:48,medium:52,large:58});
  assert.equal(LIST_TABLE_CONTRACT.result,80);
  assert.equal(LIST_TABLE_CONTRACT.table.header,38);
  assert.equal(LIST_TABLE_CONTRACT.horizontalPadding,12);
  assert.equal(LIST_TABLE_CONTRACT.gap,8);
  assert.equal(LIST_TABLE_CONTRACT.leadingSlot,36);
  assert.equal(LIST_TABLE_CONTRACT.actionSlot,36);
  assert.equal(LIST_TABLE_CONTRACT.background,'transparent');
  assert.equal(LIST_TABLE_CONTRACT.radius,0);
  assert.equal(LIST_TABLE_CONTRACT.shadow,'none');
  assert.equal(listRowHeight('small'),48);assert.equal(listRowHeight('medium'),52);assert.equal(listRowHeight('large'),58);assert.equal(listRowHeight('large','result'),80);
  assert.deepEqual(CONTROL_LAYOUT.practice,{rowHeight:52,singleRowHeight:52,leadingSize:36,iconSize:23,gap:8,titleSize:15,subtitleSize:12});
  assert.equal(CONTROL_LAYOUT.social.rowHeight,52);
  assert.equal(CONTROL_LAYOUT.social.rankWidth,36);
  assert.equal(CONTROL_LAYOUT.social.actionSize,36);
  assert.equal(CONTROL_LAYOUT.social.compactActionSize,36);
  assert.equal(UI_TOKENS.account.factRowMinHeight,52);
});

test('chrome mask and layer contract has one shared source',()=>{
  assert.deepEqual(CHROME_CONTRACT.mask.stops,[{offset:0,alpha:.55},{offset:.38,alpha:.28},{offset:.76,alpha:.07},{offset:1,alpha:0}]);
  assert.equal(CHROME_CONTRACT.mask.blur,7);
  assert.equal(CHROME_CONTRACT.mask.nativeBlurIntensity,8);
  assert.equal(CHROME_CONTRACT.mask.glassAlpha,.10);
  assert.deepEqual(CHROME_CONTRACT.layers,{content:0,mask:20,header:30,tabs:30,floating:32,modal:110});
  const chrome=read('packages/alantil-ui/chrome.js'),nativeMask=read('mobile/ui/chrome-mask.native.js'),webMask=read('mobile/ui/chrome-mask.web.js'),generated=read('src/shared/styles/shared-visual-tokens.css'),tokens=read('packages/alantil-ui/tokens.js');
  assert.doesNotMatch(chrome,/\bmaskStops\b|\bwebMaskTop\b|\bwebMaskBottom\b/);
  assert.doesNotMatch(tokens,/maskGlass:/);
  assert.match(nativeMask,/CH\.mask\.stops/);assert.match(nativeMask,/CH\.mask\.nativeBlurIntensity/);assert.match(nativeMask,/CH\.layers\.mask/);
  assert.match(webMask,/CH\.mask\.web\.bottom/);assert.match(webMask,/CH\.mask\.web\.top/);assert.match(webMask,/CH\.mask\.blur/);assert.match(webMask,/CH\.layers\.mask/);
  for(const value of ['--ui-layer-mask:20','--ui-layer-header:30','--ui-layer-tabs:30','--ui-layer-floating:32','--ui-system-mask-blur:7px'])assert.match(generated,new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('Web consumes shared list/table, bracket tabs, Friends and flat Songs geometry',()=>{
  const app=read('src/shared/styles/app.css'),profile=read('src/features/profile/profile.css'),friends=read('src/features/friends/friends-16-7.css'),practice=read('src/features/practice/practice.css'),songsList=read('src/shared/ui/list.js'),songsCatalog=read('src/features/songs/catalog.js'),table=read('src/shared/styles/table-system.css'),result=read('src/shared/styles/components.css');
  assert.match(app,/repeat\(var\(--profile-tab-count,3\),minmax\(0,1fr\)\)/);assert.match(profile,/repeat\(var\(--profile-tab-count,3\),minmax\(0,1fr\)\)/);assert.doesNotMatch(profile,/repeat\(3,1fr\)/);
  assert.match(friends,/z-index:var\(--z-tabs\)/);assert.match(friends,/min-height:var\(--table-row-height\)/);assert.match(friends,/gap:var\(--ui-list-gap\)/);
  assert.match(practice,/min-height:var\(--table-row-height\)/);
  assert.match(songsList,/renderContentListRow/);assert.doesNotMatch(songsList,/class="sectionMenuItem"/);assert.match(songsCatalog,/secondary: songArtists\(song\.artist\)\.join/);assert.doesNotMatch(songsCatalog,/pills: songArtists/);
  assert.match(table,/--table-row-height:var\(--ui-list-row-medium\)/);assert.match(table,/--table-head-height:var\(--ui-list-table-header-height\)/);
  assert.match(result,/height:var\(--ui-list-result-height\)/);
});

test('Mobile consumes shared row sizing and keeps controls above the mask',()=>{
  const parity=read('mobile/ui/parity.js'),friends=read('mobile/screens/friends.js'),practice=read('mobile/screens/practice.js'),practiceGames=read('mobile/screens/practice-games.js'),songs=read('mobile/screens/songs.js'),settings=read('mobile/screens/profile-main.js'),story=read('mobile/screens/story-word-list.js'),stationTest=read('mobile/screens/station-test.js'),learn=read('mobile/screens/learn.js');
  assert.match(parity,/listRowHeight\(sizeCode,variant\)/);assert.match(parity,/theme\.listTable\.horizontalPadding/);
  assert.match(friends,/theme\.chrome\.layers\.tabs/);assert.match(friends,/onOpenExtendedStats/);assert.doesNotMatch(friends,/AdminUsersPane/);
  assert.match(practice,/theme\.listTable\.horizontalPadding/);assert.doesNotMatch(practice,/minHeight:P\.rowHeight/);assert.match(practiceGames,/listRowHeight\(settings\?\.text_size_code\)/);assert.doesNotMatch(practiceGames,/scopeDictRow:\{minHeight:44|scopeSectionRow:\{minHeight:44/);
  assert.match(songs,/listRowHeight\(settings\?\.text_size_code\)/);assert.doesNotMatch(songs,/playlistRow:\{minHeight:58|songRow:\{minHeight:58/);
  assert.match(settings,/listRowHeight\(settings\?\.text_size_code\)/);assert.match(story,/listRowHeight\(settings\?\.text_size_code\)/);
  assert.match(stationTest,/height:theme\.listTable\.result/);assert.match(learn,/height:theme\.listTable\.result/);
});

test('Extended statistics uses table parity and loader replacement instead of full-screen residue',()=>{
  const admin=read('src/features/admin/index.js'),adminCss=read('src/features/admin/admin.css'),mobileAdmin=read('mobile/screens/admin-users.js'),router=read('src/app/router.js'),registry=read('src/app/screen-registry.js'),root=read('mobile/AppRoot.js'),components=read('mobile/ui/components.js');
  assert.match(admin,/const loading = scroll\.querySelector\("\.loadingState"\)/);assert.match(admin,/loading\?\.remove\(\);[\s\S]*scroll\.appendChild\(table\)/);assert.match(admin,/loading\.replaceWith\(empty\)/);assert.match(admin,/loading\.replaceWith\(failure\)/);
  assert.match(mobileAdmin,/usersTable/);assert.match(mobileAdmin,/tableHead/);assert.match(mobileAdmin,/storyKeys/);assert.doesNotMatch(mobileAdmin,/function AdminRow/);assert.match(adminCss,/adminWordTile\{[^}]*height:var\(--table-row-height\)[^}]*background:transparent/s);
  assert.match(router,/\/friends\/statistics/);assert.match(router,/if \(current\.route === "admin\.users"\) return \{ route: "friends\.home"/);assert.match(registry,/"admin\.users": \{ layout: "detail", header: "standard", bottomNav: false/);
  assert.match(root,/screen==='adminUsers'/);assert.match(root,/showNav=false/);assert.match(root,/onOpenExtendedStats=\{\(\)=>setScreen\('adminUsers'\)\}/);assert.match(root,/tab==='friends'\?'friends'/);assert.doesNotMatch(root,/friends_statistics/);assert.match(components,/listRowHeight\(settings\?\.text_size_code\)/);
});

test('Ashyk UI consumes shared visual geometry without changing game modules',()=>{
  const mobileTheme=read('mobile/ui/theme.js'),mobileAshyk=read('mobile/screens/ashyk.js');
  assert.match(mobileTheme,/ashyk:W\.ashyk/);assert.match(mobileAshyk,/theme\.ashyk\.buttonHeight/);assert.match(mobileAshyk,/theme\.ashyk\.buttonRadius/);assert.match(mobileAshyk,/theme\.ashyk\.segmentedHeight/);
});

test('Web visual manifest is complete and every recorded blob SHA matches current 16.7 source',()=>{
  const audit=verifyWebVisualSourceManifest();assert.equal(audit.ref,'16.7.0');assert.equal(audit.complete,true);assert.deepEqual(audit.missingCoverage,[]);
  const groups=[WEB_VISUAL_SOURCES.styles,WEB_VISUAL_SOURCES.ui,WEB_VISUAL_SOURCES.account,WEB_VISUAL_SOURCES.features];for(const entries of groups)for(const [file,expected] of entries)assert.equal(blobSha(file),expected,`stale visual manifest SHA: ${file}`);
  const featurePaths=new Set(WEB_VISUAL_SOURCES.features.map(([file])=>file));for(const required of ['src/features/practice/practice.css','src/features/friends/friends-16-7.css','src/features/ashyk/ashyk.css','src/features/admin/admin.css'])assert.ok(featurePaths.has(required),`missing manifest source ${required}`);
});

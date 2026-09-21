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


test('Header actions and bracket tabs consume semantic shared contracts',()=>{
  assert.equal(CHROME_CONTRACT.actionSize,36);
  assert.equal(CHROME_CONTRACT.actionIconSize,20);
  const shell=read('src/shared/styles/shell.css'),components=read('mobile/ui/components.js'),profileTabs=read('mobile/ui/profile-tabs.js'),typography=read('src/shared/styles/typography.css'),pathCss=read('src/features/path/path.css'),profileCss=read('src/features/profile/profile.css'),appCss=read('src/shared/styles/app.css'),adminMobile=read('mobile/screens/admin-users.js'),friendsMobile=read('mobile/screens/friends.js');
  assert.match(shell,/width:var\(--ui-header-action-size\)/);assert.match(shell,/height:var\(--ui-header-action-size\)/);assert.match(shell,/width:var\(--ui-header-action-icon-size\)/);
  assert.match(components,/BackIcon size=\{CH\.actionIconSize\}/);assert.match(components,/width:CH\.actionSize,height:CH\.actionSize/);
  assert.match(profileTabs,/useSemanticTypography/);assert.match(profileTabs,/type\.caption\.fontSize/);assert.match(profileTabs,/type\.caption\.lineHeight/);
  assert.match(typography,/:where\(\.profilePrimaryTab,\.storyTab\)\{font-size:var\(--text-caption\);line-height:1\.35\}/);
  assert.doesNotMatch(pathCss,/\.storyTab\{[^}]*clamp\(10px/s);
  assert.doesNotMatch(pathCss,/\.storyTab\{font-size:9px/);
  assert.doesNotMatch(profileCss,/--ui-profile-tab-font-size|--ui-profile-tab-line-height/);
  assert.doesNotMatch(appCss,/--ui-profile-tab-font-size|--ui-profile-tab-line-height/);
  assert.doesNotMatch(adminMobile,/SearchIcon size=\{18\}/);
  assert.doesNotMatch(friendsMobile,/SearchIcon size=\{18\}/);
});

test('bottom navigation keeps 13.15.12 geometry with selected-state inversion',()=>{
  const shell=read('src/shared/styles/shell.css'),app=read('src/shared/styles/app.css'),mobile=read('mobile/ui/social-bottom-nav.js');
  assert.match(shell,/grid-template-columns:repeat\(4,1fr\)/);
  assert.match(shell,/\.bottomNavIconBubble\{[\s\S]*width:38px;[\s\S]*height:38px;[\s\S]*border-radius:50%/);
  assert.match(shell,/\.bottomNavIcon\{display:block;width:20px;height:20px/);
  assert.match(shell,/\.bottomNavElbrus\{[^}]*width:29px;[^}]*max-height:17px;[^}]*filter:brightness\(0\) saturate\(100%\)/);
  assert.match(shell,/\.bottomNavItem\.active \.bottomNavElbrus\{opacity:1;filter:none\}/);
  assert.doesNotMatch(shell,/\.bottomNavPathBubble\{[^}]*background:/);
  assert.doesNotMatch(app,/--ui-bottom-nav-/);
  assert.match(mobile,/tintColor:active\?C\.inverse:C\.text1/);
  assert.doesNotMatch(mobile,/path&&s\.pathBubble|pathBubble:/);
});

test('Web consumes shared list/table, bracket tabs, Friends and flat Songs geometry',()=>{
  const app=read('src/shared/styles/app.css'),profile=read('src/features/profile/profile.css'),profileTabs=read('src/shared/styles/profile-tabs.css'),friends=read('src/features/friends/friends-16-7.css'),chrome=read('src/shared/styles/chrome.css'),practice=read('src/features/practice/practice.css'),songsList=read('src/shared/ui/list.js'),songsCatalog=read('src/features/songs/catalog.js'),table=read('src/shared/styles/table-system.css'),result=read('src/shared/styles/components.css');
  assert.match(profileTabs,/repeat\(var\(--profile-tab-count,3\),minmax\(0,1fr\)\)/);assert.doesNotMatch(app,/repeat\(var\(--profile-tab-count,3\),minmax\(0,1fr\)\)/);assert.doesNotMatch(profile,/repeat\(var\(--profile-tab-count,3\),minmax\(0,1fr\)\)|repeat\(3,1fr\)/);
  assert.match(chrome,/\[data-feature=\"friends\"\] \.socialHeader\{[\s\S]*z-index:var\(--z-tabs\)/);assert.match(friends,/min-height:var\(--table-row-height\)/);assert.match(friends,/gap:var\(--ui-list-gap\)/);
  assert.match(practice,/min-height:var\(--table-row-height\)/);
  assert.match(songsList,/renderContentListRow/);assert.doesNotMatch(songsList,/class="sectionMenuItem"/);assert.match(songsCatalog,/secondary: songArtists\(song\.artist\)\.join/);assert.doesNotMatch(songsCatalog,/pills: songArtists/);
  assert.match(table,/--table-row-height:var\(--ui-list-row-medium\)/);assert.match(table,/--table-head-height:var\(--ui-list-table-header-height\)/);
  assert.match(result,/height:var\(--ui-list-result-height\)/);
});

test('Mobile consumes shared row sizing and keeps controls above the mask',()=>{
  const parity=read('mobile/ui/parity.js'),friends=read('mobile/screens/friends.js'),practice=read('mobile/screens/practice.js'),practiceGames=read('mobile/screens/practice-games.js'),songs=read('mobile/screens/songs.js'),settings=read('mobile/screens/profile-main.js'),story=read('mobile/screens/story-word-list.js'),stationTest=read('mobile/screens/station-test.js'),learn=read('mobile/screens/learn.js');
  assert.match(parity,/listRowHeight\(sizeCode,variant\)/);assert.match(parity,/theme\.listTable\.horizontalPadding/);
  assert.match(friends,/theme\.chrome\.layers\.tabs/);assert.match(friends,/AdminUsersPane/);assert.match(friends,/visibleMode===['"]stats['"]/);
  assert.doesNotMatch(friends,/onOpenExtendedStats/);
  assert.match(practice,/theme\.listTable\.horizontalPadding/);assert.doesNotMatch(practice,/minHeight:P\.rowHeight/);assert.match(practiceGames,/listRowHeight\(settings\?\.text_size_code\)/);assert.doesNotMatch(practiceGames,/scopeDictRow:\{minHeight:44|scopeSectionRow:\{minHeight:44/);
  assert.match(songs,/listRowHeight\(settings\?\.text_size_code\)/);assert.doesNotMatch(songs,/playlistRow:\{minHeight:58|songRow:\{minHeight:58/);
  assert.match(settings,/listRowHeight\(settings\?\.text_size_code\)/);assert.match(story,/listRowHeight\(settings\?\.text_size_code\)/);
  assert.match(stationTest,/height:theme\.listTable\.result/);assert.match(learn,/height:theme\.listTable\.result/);
});

test('Extended statistics is a Community tab and only user/test details leave the root shell',()=>{
  const friends=read('src/features/friends/index.js'),admin=read('src/features/admin/index.js'),adminCss=read('src/features/admin/admin.css'),mobileFriends=read('mobile/screens/friends.js'),mobileAdmin=read('mobile/screens/admin-users.js'),router=read('src/app/router.js'),registry=read('src/app/screen-registry.js'),root=read('mobile/AppRoot.js'),components=read('mobile/ui/components.js');
  assert.match(friends,/renderAdminUsersEmbedded/);
  assert.match(friends,/statsAccessState/);
  assert.match(friends,/loadingState/);
  assert.match(admin,/export async function renderAdminUsersEmbedded/);
  assert.match(adminCss,/\.adminUsersEmbedded/);
  assert.match(mobileFriends,/AdminUsersPane/);
  assert.match(mobileFriends,/accessState/);
  assert.match(mobileAdmin,/export function AdminUserDetailScreen/);
  assert.match(mobileAdmin,/usersTable/);assert.match(mobileAdmin,/tableHead/);assert.match(mobileAdmin,/storyKeys/);assert.doesNotMatch(mobileAdmin,/function AdminRow/);
  assert.match(router,/if \(!third\) return \{ route: "friends\.home", params: \{ mode: "stats" \} \}/);
  assert.match(router,/routeName === "friends\.home"[\s\S]*params\.mode === "stats"/);
  assert.match(router,/target\.route === "admin\.users"[\s\S]*friends\.home/);
  assert.match(router,/current\.route === "admin\.user"[\s\S]*friends\.home[\s\S]*mode: "stats"/);
  assert.match(registry,/"admin\.user": \{ layout: "detail", header: "standard", bottomNav: false/);
  assert.doesNotMatch(root,/screen==='adminUsers'/);
  assert.doesNotMatch(root,/setScreen\('adminUsers'\)/);
  assert.match(root,/communityMode/);
  assert.match(root,/AdminUserDetailScreen/);
  assert.match(root,/socialMessage\(language,'community'\)/);
  assert.match(components,/listRowHeight\(settings\?\.text_size_code\)/);
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

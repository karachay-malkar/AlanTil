import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const mobile=path.resolve(here,'..');
const root=path.resolve(mobile,'..');
const readMobile=(relative)=>fs.readFileSync(path.join(mobile,relative),'utf8');
const readRoot=(relative)=>fs.readFileSync(path.join(root,relative),'utf8');

const visual=readMobile('ui/web-visual-source.js');
const theme=readMobile('ui/theme.js');
const components=readMobile('ui/components.js');
const parity=readMobile('ui/parity.js');
const pathScreen=readMobile('screens/path.js');
const station=readMobile('screens/station.js');
const practice=readMobile('screens/practice.js');
const favorites=readMobile('screens/favorites.js');
const storyWords=readMobile('screens/story-word-list.js');
const account=readMobile('screens/profile.js');
const onboarding=readMobile('screens/onboarding.js');
const profile=readMobile('screens/profile-main.js');
const settingsChild=readMobile('screens/settings-child.js');
const app=JSON.parse(readMobile('app.json'));
const pkg=JSON.parse(readMobile('package.json'));
const webTheme=readRoot('src/shared/styles/theme.css');
const webShell=readRoot('src/shared/styles/shell.css');
const webChrome=readRoot('src/shared/styles/chrome.css');
const webPath=readRoot('src/features/path/path.css');
const webSegmented=readRoot('src/shared/styles/segmented-control.css');
const webPractice=readRoot('src/features/practice/practice.css');
const webProfile=readRoot('src/features/profile/profile.css');
const webStoryWords=readRoot('src/features/path/story-word-list.css');
const webOnboarding=readRoot('src/features/onboarding/onboarding.css');
const webAccount=readRoot('src/features/account/account.css');

test('16.6.2 release metadata is coherent',()=>{
  assert.equal(app.expo.version,'16.6.2');
  assert.equal(pkg.version,'16.6.2');
  assert.equal(app.expo.extra.releaseVersion,'16.6.2');
  assert.equal(app.expo.android.versionCode,25);
  assert.equal(app.expo.ios.buildNumber,'25');
  assert.match(settingsChild,/>16\.6\.2</);
});

test('16.6.2 canonical header token follows Web theme rather than Profile root override',()=>{
  assert.match(webTheme,/--header-h:46px/);
  assert.match(webChrome,/profileScroll[\s\S]*safe-top\) \+ 42px/);
  assert.match(visual,/header:46/);
  assert.match(theme,/path:W\.path/);
});

test('16.6.2 shared chrome buttons and bottom navigation follow final Web shell',()=>{
  assert.match(webShell,/appHeaderAction[\s\S]*width:36px;[\s\S]*height:36px/);
  assert.match(webShell,/bottomNav\{[\s\S]*height:calc\(var\(--nav-h\) \+ var\(--safe-bottom\)\)/);
  assert.match(webShell,/bottomNavIconBubble\{[\s\S]*width:38px;[\s\S]*height:38px/);
  assert.match(webChrome,/\.btn\{border-radius:14px/);
  assert.match(webChrome,/stationLaunchActions \.btn,[\s\S]*border-radius:15px/);
  assert.match(components,/NAV_INACTIVE='rgba\(102,97,88,\.62\)'/);
  assert.match(components,/headerCircle:\{width:CH\.actionSize,height:CH\.actionSize/);
  assert.match(components,/button:\{[^}]*borderRadius:14/s);
  assert.match(components,/buttonAction:\{borderRadius:15\}/);
  assert.match(components,/navBubble:\{[^}]*borderWidth:1/s);
  assert.match(components,/navLabel:\{[^}]*color:NAV_INACTIVE/s);
  assert.match(components,/webTopChromeMask:[\s\S]*maskImage:'linear-gradient\(to bottom/);
  assert.match(components,/webBottomChromeMask:[\s\S]*maskImage:'linear-gradient\(to top/);
});

test('16.6.2 shared segmented control uses Web 28px item geometry',()=>{
  assert.match(webSegmented,/min-height:28px/);
  assert.match(parity,/segmentItem:\s*\{[^}]*minHeight:\s*28/s);
  assert.match(parity,/segmented:\s*\{[^}]*padding:\s*2/s);
  assert.match(components,/segmentedItem:\{[^}]*minHeight:28/s);
});

test('16.6.2 Practice menu uses Web 68px flat rows and exact type geometry',()=>{
  assert.match(webPractice,/menuItem\{[^}]*min-height:68px[^}]*padding:10px 2px/s);
  assert.match(webPractice,/menuIcon\{width:36px;height:36px/);
  assert.match(webPractice,/menuItem strong\{font-size:15px\}/);
  assert.match(webPractice,/menuItem small\{[^}]*font-size:11px[^}]*line-height:1\.3/s);
  assert.match(practice,/menuRow:\{[^}]*minHeight:68[^}]*paddingHorizontal:2[^}]*paddingVertical:10[^}]*gap:10/s);
  assert.match(practice,/menuLeading:\{width:36,height:36\}/);
  assert.match(practice,/menuTitle:\{fontSize:15[^}]*lineHeight:18/s);
  assert.match(practice,/menuSubtitle:\{[^}]*fontSize:11[^}]*lineHeight:14\.3/s);
});

test('16.6.2 Favorites uses Web set-preparation offsets and flat word rows',()=>{
  assert.match(webChrome,/setPreparationToolbar[\s\S]*header-h\) \+ 4px/);
  assert.match(webChrome,/setPreparationWords[\s\S]*header-h\) \+ 54px/);
  assert.match(webChrome,/setPreparationFooter[\s\S]*action-edge-gap/);
  assert.doesNotMatch(favorites,/<SurfaceCard>/);
  assert.match(favorites,/toolbar:\{[^}]*top:theme\.control\.header\+4[^}]*left:14[^}]*right:14[^}]*height:34/s);
  assert.match(favorites,/list:\{[^}]*paddingTop:theme\.control\.header\+54[^}]*paddingHorizontal:14[^}]*paddingBottom:154/s);
  assert.match(favorites,/row:\{height:52,minHeight:52/s);
  assert.match(favorites,/footer:\{[^}]*left:14[^}]*right:14[^}]*bottom:theme\.chrome\.actionEdgeGap/s);
  assert.match(favorites,/<Button action primary/);
});

test('16.6.2 Story Word List moves search into header and matches 52px Web rows',()=>{
  assert.match(webStoryWords,/storyWordsList[\s\S]*header-h\) \+ 8px/);
  assert.match(webStoryWords,/storyWordRow\{[^}]*height:52px;min-height:52px/s);
  assert.match(webStoryWords,/storyWordHeaderSearch\.isOpen\{width:min\(72vw,300px\)\}/);
  assert.match(storyWords,/HeaderCircleButton/);
  assert.match(storyWords,/SearchIcon/);
  assert.doesNotMatch(storyWords,/searchWrap:/);
  assert.match(storyWords,/list:\{paddingTop:theme\.control\.header\+8/);
  assert.match(storyWords,/row:\{height:52,minHeight:52/);
  assert.match(storyWords,/searchWidth=Math\.min\(width\*\.72,300\)/);
});

test('16.6.2 Onboarding uses Web setup insets and does not force old 44px continue button',()=>{
  assert.match(webOnboarding,/learningSetupScreen[\s\S]*header-h\) \+ var\(--content-rest-gap\)/);
  assert.match(webOnboarding,/learningSetupPane\{width:min\(100%,560px\)/);
  assert.match(onboarding,/paddingTop: theme\.control\.header \+ theme\.chrome\.contentRestGap/);
  assert.match(onboarding,/maxWidth: 560/);
  assert.doesNotMatch(onboarding,/fullButton:\s*\{[^}]*minHeight:\s*44/s);
});

test('16.6.2 Account uses canonical avatar assets and Web flat panel geometry',()=>{
  assert.match(webAccount,/accountStack\{width:min\(100%,520px\)/);
  assert.match(webAccount,/accountGenderChoice\{[^}]*min-height:170px/s);
  assert.match(account,/PROFILE_AVATAR_MALE=require\('\.\.\/\.\.\/assets\/images\/profile\/avatar_male\.png'\)/);
  assert.match(account,/PROFILE_AVATAR_FEMALE=require\('\.\.\/\.\.\/assets\/images\/profile\/avatar_female\.png'\)/);
  assert.match(account,/accountPanel:\{[^}]*margin:0[^}]*borderWidth:0[^}]*borderRadius:0[^}]*backgroundColor:'transparent'/s);
  assert.match(account,/accountGenderChoice:\{[^}]*minHeight:170/s);
  assert.doesNotMatch(account,/avatarHead:/);
  assert.doesNotMatch(account,/avatarBody:/);
});

test('16.6.2 Profile root replaces brand header with Web primary tabs and avatar frame',()=>{
  assert.match(webProfile,/profileView\{[^}]*grid-template-rows:30px minmax\(0,1fr\)/s);
  assert.match(webProfile,/profilePrimaryTab\{[^}]*min-height:30px/s);
  assert.match(webProfile,/profileAvatarFrame\{[^}]*width:min\(72vw,286px\)[^}]*aspect-ratio:4\/5/s);
  assert.match(webProfile,/profileAccountButton\{[^}]*right:-12px[^}]*bottom:14px[^}]*width:42px[^}]*height:42px/s);
  assert.match(webProfile,/profileNickname\{[^}]*font-size:22px/s);
  assert.match(webProfile,/profileStat\{min-height:72px/s);
  assert.doesNotMatch(profile,/<Header title="Alan Til!"/);
  assert.match(profile,/tabs:\{[^}]*top:2[^}]*height:30/s);
  assert.match(profile,/body:\{[^}]*paddingTop:42[^}]*paddingHorizontal:14/s);
  assert.match(profile,/avatarFrame:\{[^}]*maxWidth:286[^}]*aspectRatio:\.8[^}]*borderRadius:2/s);
  assert.match(profile,/accountCircle:\{[^}]*right:-12[^}]*bottom:14[^}]*width:42[^}]*height:42/s);
  assert.match(profile,/nickname:\{[^}]*fontSize:22/s);
  assert.match(profile,/profileStat:\{[^}]*width:'50%'[^}]*minHeight:72/s);
});

test('16.6.2 Path geometry uses final Web chrome and path dimensions',()=>{
  assert.match(webChrome,/pathStickyControls[\s\S]*height:56px!important/);
  assert.match(webChrome,/routeMap[\s\S]*safe-top\) \+ 64px/);
  assert.match(webPath,/--station-size:60px/);
  assert.match(webPath,/--route-station-gap:43px/);
  assert.match(webTheme,/--route-scale-dot-size:4px/);
  assert.match(webTheme,/--route-scale-section-size:6px/);
  assert.match(webTheme,/--route-scale-diamond-size:9px/);
  assert.match(visual,/rootControlsHeight:56/);
  assert.match(visual,/mapTop:64/);
  assert.match(visual,/stationSize:60/);
  assert.match(visual,/stationGap:43/);
  assert.match(visual,/scaleDot:4/);
  assert.match(visual,/scaleSection:6/);
  assert.match(visual,/scaleDiamond:9/);
  assert.match(pathScreen,/top:0,left:0,right:0,height:theme\.path\.rootControlsHeight/);
  assert.match(pathScreen,/pathViewport:\{position:'absolute',top:0/);
  assert.match(pathScreen,/paddingTop:theme\.path\.mapTop,paddingLeft:20,paddingRight:50/);
  assert.match(pathScreen,/width:theme\.path\.stationSize,height:theme\.path\.stationSize/);
  assert.match(pathScreen,/right:theme\.path\.scaleRight,top:'20%',bottom:'20%',width:theme\.path\.scaleWidth/);
});

test('16.6.2 does not reintroduce the old Path 58px/66px geometry',()=>{
  assert.doesNotMatch(pathScreen,/stationNode:\{[^}]*width:58/);
  assert.doesNotMatch(pathScreen,/pathControls:\{[^}]*height:66/);
  assert.doesNotMatch(pathScreen,/scaleDot:\{[^}]*width:3/);
  assert.doesNotMatch(pathScreen,/scaleDiamond:\{[^}]*width:7/);
});

test('16.6.2 Station uses final Web chrome offsets and flat statistics layout',()=>{
  assert.match(webChrome,/stationViewTabs\{top:calc\(var\(--safe-top\) \+ var\(--header-h\) - 4px\)!important;height:28px!important\}/);
  assert.match(webChrome,/stationMenuToolbar\{top:calc\(var\(--safe-top\) \+ var\(--header-h\) \+ 24px\)!important;height:28px!important\}/);
  assert.match(webChrome,/stationWordList[\s\S]*header-h\) \+ 56px/);
  assert.match(webChrome,/stationLaunchPanel\{bottom:calc\(var\(--safe-bottom\) \+ var\(--action-edge-gap\)\)!important/);
  assert.match(webChrome,/stationStatisticsPane[\s\S]*header-h\) \+ 36px/);
  assert.match(station,/tabs:\{[^}]*top:theme\.control\.header-4[^}]*height:28/s);
  assert.match(station,/toolbar:\{[^}]*top:theme\.control\.header\+24[^}]*height:28/s);
  assert.match(station,/wordList:\{[^}]*paddingTop:theme\.control\.header\+56[^}]*paddingBottom:108/s);
  assert.match(station,/launchPanel:\{[^}]*bottom:theme\.chrome\.actionEdgeGap/s);
  assert.match(station,/statsScroll:\{[^}]*paddingTop:theme\.control\.header\+36/s);
  assert.match(station,/<SurfaceCard flat style=\{styles\.summaryCard\}>/);
  assert.match(station,/<SurfaceCard flat style=\{styles\.attemptsFlat\}>/);
});

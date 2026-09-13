import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseTranslationGroups } from '../../packages/alantil-core/example-groups.js';
import { splitGroups } from '../../packages/alantil-core/word-selection.js';
import { buildLearnCardModel } from '../../packages/alantil-core/learn-card.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const mobile=path.resolve(here,'..');
const root=path.resolve(mobile,'..');
const read=(file)=>fs.readFileSync(path.join(mobile,file),'utf8');
const readRoot=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const app=JSON.parse(read('app.json'));
const pkg=JSON.parse(read('package.json'));
const appRoot=read('AppRoot.js');
const i18n=read('i18n.js');
const guideState=read('platform/guide-state.js');
const profileApi=read('platform/profile-api.js');
const pathScreen=read('screens/path.js');
const storyWords=read('screens/story-word-list.js');
const profile=read('screens/profile-main.js');
const learn=read('screens/learn.js');
const games=read('screens/practice-games.js');
const stationTest=read('screens/station-test.js');
const parity=read('ui/parity.js');
const guide=read('ui/guide.js');
const theme=read('ui/theme.js');
const settingsChild=read('screens/settings-child.js');
const wordRenderers=readRoot('src/shared/ui/word-renderers.js');
const wordSelection=readRoot('packages/alantil-core/word-selection.js');

// 1
test('16.6.8 release metadata and Osuyat branding are coherent',()=>{
  assert.equal(app.expo.name,'Osuyat');
  assert.equal(app.expo.version,'16.6.8');
  assert.equal(pkg.version,'16.6.8');
  assert.equal(app.expo.extra.releaseVersion,'16.6.8');
  assert.equal(app.expo.android.versionCode,33);
  assert.equal(app.expo.ios.buildNumber,'33');
  assert.equal(app.expo.icon,'./assets/branding/osuyat-icon.png');
  assert.equal(app.expo.android.adaptiveIcon.foregroundImage,'./assets/branding/osuyat-icon.png');
  assert.match(appRoot,/bootBrand}>Osuyat</);
  assert.ok(fs.existsSync(path.join(mobile,'assets/branding/osuyat-icon.png')));
});

// 2
test('16.6.8 interface copy consistently exposes Osuyat instead of the old brand',()=>{
  for(const token of["'common.alan_til':M('Osuyat'","'common.put_alan_til':M('Путь — Osuyat'","'common.profil_alan_til':M('Профиль — Osuyat'","'common.test_alan_til':M('Тест — Osuyat'"]) assert.ok(i18n.includes(token),token);
  assert.match(settingsChild,/>16\.6\.8</);
  assert.match(settingsChild,/>13\.09\.2026</);
});

// 3
test('first-run guide completion is persisted and gates automatic Story Stele opening',()=>{
  assert.match(guideState,/general_completed:Boolean\(value\?\.general_completed\)/);
  assert.match(pathScreen,/setGeneralCompleted\(Boolean\(guideState\.general_completed\)\)/);
  assert.match(pathScreen,/if\(!guideState\.general_completed\)\{beginNativeGeneralGuide\(\)/);
  assert.match(pathScreen,/pathReady&&guideStateReady&&generalCompleted/);
  assert.match(pathScreen,/saveNativeGuideState\(\{general_completed:true\}\)/);
  assert.match(pathScreen,/await showUnseenStele\(\)/);
});

// 4
test('Path scale uses measured catalog targets and the floating word-list control stays clear of the guide',()=>{
  assert.match(pathScreen,/targetY:Number\.isFinite\(catalogLayout\?\.y\)\?catalogLayout\.y:null/);
  assert.match(pathScreen,/const jumpScale=\(part\)=>\{if\(!Number\.isFinite\(part\?\.targetY\)\)return;/);
  assert.match(pathScreen,/wordListFloat:\{[^}]*left:10[^}]*top:'80%'[^}]*marginTop:-64/s);
});

// 5
test('Story Word List is virtualized, deferred and bounded for large dictionaries',()=>{
  assert.match(storyWords,/useDeferredValue/);
  assert.match(storyWords,/SectionList/);
  assert.match(storyWords,/flattenSections/);
  assert.match(storyWords,/initialNumToRender=\{18\}/);
  assert.match(storyWords,/maxToRenderPerBatch=\{16\}/);
  assert.match(storyWords,/updateCellsBatchingPeriod=\{32\}/);
  assert.match(storyWords,/windowSize=\{7\}/);
  assert.match(storyWords,/removeClippedSubviews/);
});

// 6
test('Profile uses memory plus AsyncStorage cache before background network refresh',()=>{
  assert.match(profileApi,/PROFILE_CACHE_PREFIX='alantil:16\.6\.8:profile:'/);
  assert.match(profileApi,/const profileMemory=new Map\(\)/);
  assert.match(profileApi,/export async function loadCachedNativeProfile/);
  assert.match(profileApi,/AsyncStorage\.getItem\(cacheKey\(id\)\)/);
  assert.match(profileApi,/await writeProfileCache\(userId,profile\)/);
  assert.match(profile,/loadCachedNativeProfile/);
  assert.match(profile,/const ticket=\+\+generation/);
  assert.match(profile,/ticket!==generation/);
});

// 7
test('Learn supports horizontal swipe decisions with animation locking and card reset',()=>{
  assert.match(learn,/PanResponder\.create/);
  assert.match(learn,/Math\.abs\(gesture\.dx\)>10/);
  assert.match(learn,/const threshold=Math\.max\(72,cardWidth\*\.3\)/);
  assert.match(learn,/settleDecision\(true\)/);
  assert.match(learn,/settleDecision\(false\)/);
  assert.match(learn,/gestureLock\.current=true/);
  assert.match(learn,/translateX\.setValue\(0\)/);
  assert.match(learn,/setCardRevision\(value=>value\+1\)/);
});

// 8
test('Learn card rows align translation meaning numbers with example groups',()=>{
  assert.match(learn,/cardModel\?\.back\?\.translationGroups/);
  assert.match(learn,/translationGroups\.find\(\(group\)=>group\.index===index\)/);
  const model=buildLearnCardModel({word:'сёз',trans:'1. слово; 2. речь',example:'1.1 Бир сёз ✦ Одно слово; 2.1 Тюз сёз ✦ Верная речь'});
  assert.deepEqual(model.back.translationGroups.map((row)=>[row.index,row.number,row.text]),[[0,1,'слово'],[1,2,'речь']]);
});

// 9
test('shared translation parser removes numeric markers and preserves semantic group numbers',()=>{
  assert.deepEqual(parseTranslationGroups('1. первый; 2) второй; 4 - четвёртый').map((row)=>({index:row.index,number:row.number,text:row.text})),[
    {index:0,number:1,text:'первый'},
    {index:1,number:2,text:'второй'},
    {index:3,number:4,text:'четвёртый'},
  ]);
  assert.deepEqual(splitGroups('один; два'),['один','два']);
  assert.match(wordSelection,/parseTranslationGroups\(text\)\.map\(\(group\)=>group\.text\)/);
});

// 10
test('Web word renderers consume the same semantic translation parser as Mobile',()=>{
  assert.match(wordRenderers,/parseExampleGroups, parseTranslationGroups/);
  assert.doesNotMatch(wordRenderers,/splitGroups/);
  assert.match(wordRenderers,/group\.number/);
  assert.match(wordRenderers,/translation\.text/);
});

// 11
test('General Test displays a real progress bar and keeps the question typography readable',()=>{
  assert.match(games,/OptionChoice, ProgressBar, Screen/);
  assert.match(games,/const progress=state\.items\.length\?\(state\.index\/state\.items\.length\)\*100:0/);
  assert.match(games,/<ProgressBar value=\{progress\}\/>/);
  assert.match(games,/testProgress:\{[^}]*top:theme\.control\.header\+3[^}]*left:14[^}]*right:14/s);
  assert.match(games,/questionText:\{[^}]*lineHeight:48[^}]*paddingVertical:5[^}]*includeFontPadding:true/s);
});

// 12
test('Station Test mirrors General Test progress and prompt geometry',()=>{
  assert.match(stationTest,/OptionChoice, ProgressBar, Screen/);
  assert.match(stationTest,/const progress=session\.questions\.length\?\(session\.index\/session\.questions\.length\)\*100:0/);
  assert.match(stationTest,/<ProgressBar value=\{progress\}\/>/);
  assert.match(stationTest,/progressWrap:\{[^}]*top:theme\.control\.header\+3[^}]*left:14[^}]*right:14/s);
  assert.match(stationTest,/prompt:\{[^}]*lineHeight:48[^}]*paddingVertical:5[^}]*includeFontPadding:true/s);
});

// 13
test('Result rows normalize multiline marquee copy and metric values fit fixed summaries',()=>{
  assert.match(parity,/replace\(\/\\s\*\\r\?\\n\+\\s\*\/gu,'; '\)/);
  assert.match(parity,/numberOfLines=\{1\} adjustsFontSizeToFit minimumFontScale=\{\.78\}/);
  assert.match(parity,/numberOfLines=\{1\} adjustsFontSizeToFit minimumFontScale=\{\.72\}/);
  assert.match(parity,/metric:\s*\{[^}]*minWidth:\s*0[^}]*overflow:\s*'visible'/s);
});

// 14
test('Guide help placement supports the lower-right Learn control without changing Path default',()=>{
  assert.match(guide,/placement='leftCenter'/);
  assert.match(guide,/placement==='bottomRight'/);
  assert.match(guide,/bottom:Math\.max\(12,insets\.bottom\+theme\.chrome\.guide\.bottomGap\)/);
  assert.match(learn,/GuideHelpButton placement="bottomRight" onPress=/);
});

// 15
test('display, flash-card and test typography share the corrected Web-scale line height',()=>{
  assert.match(theme,/display:\{fontSize:t\.display,lineHeight:line\(t\.display,1\.16\)/);
  assert.match(theme,/wordCard:\{fontSize:t\.display,lineHeight:line\(t\.display,1\.18\)/);
  assert.match(theme,/question:\{fontSize:t\.display,lineHeight:line\(t\.display,1\.18\)/);
});

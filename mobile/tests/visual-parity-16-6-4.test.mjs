import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { getDisplayedWordCollection } from '../../packages/alantil-core/alan-display.js';
import { normalizeSupabaseWordEntry } from '../../packages/alantil-core/word-normalizer.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const mobile=path.resolve(here,'..');
const read=(file)=>fs.readFileSync(path.join(mobile,file),'utf8');
const appRoot=read('AppRoot.js');
const components=read('ui/components.js');
const sharedTokens=fs.readFileSync(path.join(mobile,'../packages/alantil-ui/tokens.js'),'utf8');
const sharedChrome=fs.readFileSync(path.join(mobile,'../packages/alantil-ui/chrome.js'),'utf8');
const visual=read('ui/web-visual-source.js');
const pathScreen=read('screens/path.js');
const station=read('screens/station.js');
const favorites=read('screens/favorites.js');
const games=read('screens/practice-games.js');
const learn=read('screens/learn.js');
const parity=read('ui/parity.js');
const profile=read('screens/profile-main.js');
const songs=read('screens/songs.js');
const stationTest=read('screens/station-test.js');
const settingsChild=read('screens/settings-child.js');
const app=JSON.parse(read('app.json'));
const pkg=JSON.parse(read('package.json'));

test('16.6.4 projects canonical dictionary rows through shared alan-display before UI and games',()=>{
  assert.match(appRoot,/getDisplayedWordCollection/);
  assert.match(appRoot,/displayWords=useMemo\(\(\)=>getDisplayedWordCollection\(words,settings\),\[words,settings\]\)/);
  assert.match(appRoot,/buildLearningRoute\(displayWords\)/);
  for(const token of['allWords={displayWords}','words={displayWords}',"openPracticeGame('test',displayWords","openPracticeGame('match',displayWords"]) assert.ok(appRoot.includes(token),token);
  assert.match(appRoot,/setWords\(Array\.isArray\(dictionaryResult\?\.words\)\?dictionaryResult\.words:\[\]\)/);
});

test('16.6.4 real bundled dictionary exposes localized numbered examples after display projection',()=>{
  const snapshot=JSON.parse(read('data/dictionary-snapshot.json'));
  const normalized=snapshot.words.map((row)=>normalizeSupabaseWordEntry(row));
  const ru=getDisplayedWordCollection(normalized,{interface_language_code:'ru',translation_language_code:'ru',alan_script_code:'cyrillic',alan_dialect_code:'canonical'});
  const exampleRow=ru.find((row)=>/\d+\.\d+\s/u.test(row.example||'')&&(row.example||'').includes('✦'));
  assert.ok(exampleRow,'projected bundled dictionary must contain numbered bilingual examples');
  assert.ok(exampleRow.word);
  assert.ok(exampleRow.trans);
  const enLatin=getDisplayedWordCollection(normalized.slice(0,20),{interface_language_code:'en',translation_language_code:'en',alan_script_code:'turkic',alan_dialect_code:'canonical'});
  assert.ok(enLatin.some((row)=>row.wordAlanTurkic&&row.word===row.wordAlanTurkic));
  assert.ok(enLatin.some((row)=>row.translationEn&&row.trans===row.translationEn));
});

test('16.6.4 system chrome exists on every Screen and stays below interactive chrome',()=>{
  assert.match(components,/export function Screen\(\{children,bottomNav=false,topChromeDepth,bottomChromeDepth\}\)/);
  assert.match(components,/<TopChromeMask height=\{top\}\/><BottomChromeMask height=\{bottom\}\/>/);
  const nativeChrome=read('ui/chrome-mask.native.js');assert.match(nativeChrome,/zIndex:29,elevation:29/);assert.match(nativeChrome,/MaskedView/);
  assert.match(components,/header:\{position:'absolute',zIndex:30,elevation:30/);
  assert.match(components,/bottomNav:\{position:'absolute',zIndex:30,elevation:30/);
  for(const token of['default:freezeDepth(58,16)','stationWords:freezeDepth(102,108)','learn:freezeDepth(58,80)','learnResults:freezeDepth(178,54)','testMenu:freezeDepth(58,93)','testResults:freezeDepth(178,54)','profile:freezeDepth(42,76)']) assert.ok(sharedChrome.includes(token),token);
});

test('16.6.4 Path restores final Web story/header and responsive map gutters',()=>{
  assert.match(pathScreen,/pathControls:\{[^}]*zIndex:30[^}]*elevation:30[^}]*paddingHorizontal:0/s);assert.match(pathScreen,/storyTabFirst:\{marginLeft:theme\.chrome\.storyTabs\.edgeInset\}/);
  assert.match(pathScreen,/paddingLeft:viewportWidth<=420\?12:20/);
  assert.match(pathScreen,/paddingRight:viewportWidth<=340\?28:viewportWidth<=420\?36:50/);
  assert.match(pathScreen,/screenDepths\.path\.top/);
  assert.match(pathScreen,/screenDepths\.path\.bottom/);
});

test('16.6.4 Station, Favorites, Test and Match use state-specific chrome and canonical control roles',()=>{
  assert.match(station,/screenDepths\.stationWords/);
  assert.match(station,/screenDepths\.stationStatistics/);
  assert.match(station,/<Button role="station\.study" disabled=/);
  assert.match(station,/<Button role="station\.test" disabled=/);
  assert.match(favorites,/screenDepths\.setPreparation/);
  assert.match(games,/function BracketCheck\(\{state='none',onPress\}\)\{return <Checkbox variant="bracket"/);
  assert.match(games,/scopeSectionRow:\{[^}]*paddingLeft:34/s);
  assert.match(games,/screenDepths\.testMenu/);
  assert.match(games,/screenDepths\.matchMenu/);
  assert.match(games,/screenDepths\.testResults/);
  assert.match(components,/CutCornerFrame fill=\{fill\} stroke=\{stroke\} cut=\{theme\.button\.cut\} radius=\{theme\.button\.radius\}/);
  assert.match(games,/launchBar:\{[^}]*zIndex:30[^}]*elevation:30/s);
  assert.match(stationTest,/screenDepths\.testResults/);
});

test('16.6.4 Learn renders shared card-model groups/examples with Web card geometry',()=>{
  assert.match(learn,/cardModel\?\.back\?\.translations/);
  assert.match(learn,/cardModel\?\.back\?\.examples/);
  assert.match(learn,/example\?\.lines\?\.map/);
  assert.doesNotMatch(learn,/parseExampleGroups/);
  assert.match(learn,/paddingHorizontal:8/);
  assert.match(learn,/borderRadius:theme\.radius\.lg/);
  assert.match(learn,/cardInnerBorder:\{[^}]*left:10[^}]*right:10[^}]*top:10[^}]*bottom:10[^}]*borderRadius:13/s);
  assert.match(learn,/backFace:\{[^}]*paddingTop:30[^}]*paddingHorizontal:18[^}]*paddingBottom:58/s);
  assert.match(learn,/groups:\{[^}]*gap:18/s);
  assert.match(learn,/groupExample:\{[^}]*marginTop:6[^}]*fontSize:13[^}]*lineHeight:19/s);
  assert.match(learn,/screenDepths\.learn/);
  assert.match(learn,/decisions:\{[^}]*zIndex:30[^}]*elevation:30/s);
});

test('16.6.4 Settings/Profile use Web-specific flat controls instead of generic action buttons',()=>{
  assert.match(parity,/export function SmallActionButton/);
  assert.match(parity,/smallAction:\s*\{[^}]*minHeight:\s*theme\.button\.settingsSmallHeight[^}]*borderRadius:\s*theme\.button\.settingsSmallRadius[^}]*backgroundColor:\s*'transparent'/s);
  assert.match(profile,/<SmallActionButton active=\{dirty\}/);
  assert.match(profile,/<SmallActionButton active=\{dictionary\.needsUpdate&&!dictionaryBusy\}/);
  assert.match(profile,/tabs:\{[^}]*top:theme\.chrome\.profileTabs\.top[^}]*left:theme\.chrome\.profileTabs\.side[^}]*height:theme\.chrome\.profileTabs\.height/s);assert.match(profile,/\{`\[ \$\{label\} \]`\}/);
  assert.match(profile,/problemChip:\{[^}]*minWidth:92[^}]*borderWidth:1[^}]*backgroundColor:'transparent'/s);
  assert.doesNotMatch(profile,/problemChip:\{[^}]*borderRadius:999/s);
  assert.match(profile,/screenDepths\.profile/);
});

test('16.6.4 Songs inline word card is flat and renders grouped examples',()=>{
  assert.match(songs,/buildLearnCardModel/);
  assert.match(songs,/model\.back\.translations/);
  assert.match(songs,/model\.back\.examples/);
  assert.match(songs,/wordCard:\{marginBottom:13,paddingVertical:4\}/);
  assert.doesNotMatch(songs,/wordCard:\{[^}]*borderRadius/s);
  assert.match(songs,/wordGroupExample:\{[^}]*marginTop:6[^}]*fontSize:13[^}]*lineHeight:19/s);
});

test('16.6.4 release metadata is coherent',()=>{
  assert.equal(app.expo.version,'16.6.6');
  assert.equal(pkg.version,'16.6.6');
  assert.equal(app.expo.extra.releaseVersion,'16.6.6');
  assert.equal(app.expo.android.versionCode,31);
  assert.equal(app.expo.ios.buildNumber,'31');
  assert.match(settingsChild,/>16\.6\.6</);
  assert.match(settingsChild,/>06\.09\.2026</);
});

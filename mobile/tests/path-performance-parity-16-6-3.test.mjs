import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const mobile=path.resolve(here,'..');
const read=(file)=>fs.readFileSync(path.join(mobile,file),'utf8');
const pathScreen=read('screens/path.js');
const sharedTokens=fs.readFileSync(path.join(mobile,'../packages/alantil-ui/tokens.js'),'utf8');
const sharedChrome=fs.readFileSync(path.join(mobile,'../packages/alantil-ui/chrome.js'),'utf8');
const visual=read('ui/web-visual-source.js');
const pathState=read('platform/path-state.js');

test('Path scroll no longer re-renders the whole route on every scroll event',()=>{
  assert.doesNotMatch(pathScreen,/setScrollState/);
  assert.doesNotMatch(pathScreen,/setStationRows/);
  assert.match(pathScreen,/const onPathScroll=\(event\)=>\{const offset=event\.nativeEvent\.contentOffset\.y;offsetRef\.current=offset;routeScaleRef\.current\?\.updateOffset\(offset\);\}/);
  assert.match(pathScreen,/useImperativeHandle\(ref/);
  assert.match(pathScreen,/if\(stateRef\.current\.passed===passed&&stateRef\.current\.current===current\)return;/);
});

test('Path geometry batches station, section and catalog measurements into one route snapshot',()=>{
  assert.match(pathScreen,/geometryFrameRef\.current=requestAnimationFrame/);
  assert.match(pathScreen,/buffer\.stations\.size<displayStations\.length/);
  assert.match(pathScreen,/buffer\.sections\.size<displaySections\.length/);
  assert.match(pathScreen,/buffer\.catalogs\.size<displayCatalogs\.length/);
  assert.match(pathScreen,/setGeometry\(\{map:/);
});

test('Path uses final Web four-step snake and final medium spacing',()=>{
  assert.match(pathScreen,/POSITION_PATTERN=\[-1,0,1,0\]/);
  assert.match(pathScreen,/Math\.min\(theme\.path\.waveAmplitudeMax,Math\.max\(theme\.path\.waveAmplitudeMin,viewportWidth\*theme\.path\.waveAmplitudeWidthRatio\)\)/);
  assert.match(sharedTokens,/stationGap:58/);
  assert.match(sharedTokens,/stationMetaReserve:52/);
  assert.match(sharedTokens,/waveAmplitudeMin:64/);
  assert.match(sharedTokens,/waveAmplitudeWidthRatio:\.22/);
  assert.match(sharedTokens,/waveAmplitudeMax:90/);
  assert.match(pathScreen,/routeSectionStations:\{[^}]*gap:theme\.path\.stationGap[^}]*paddingBottom:theme\.path\.stationMetaReserve/s);
  assert.match(pathScreen,/sectionHeading/);
});

test('Story Stele auto-open marks scoped seen state and manual reopen stays available',()=>{
  assert.match(pathState,/STORY_STELE_SEEN_KEY='alantil_story_intro_seen_v1'/);
  const autoSeen=pathScreen.indexOf('const seen=await hasSeenNativeStoryStele(activeStory)');
  const autoMark=pathScreen.indexOf('await markNativeStorySteleSeen(activeStory).catch(()=>{})',autoSeen);
  const autoOpen=pathScreen.indexOf('setSteleOpen(true)',autoMark);
  assert.ok(autoSeen>=0&&autoMark>autoSeen&&autoOpen>autoMark);
  assert.match(pathScreen,/const openStele=async\(\)=>\{await markNativeStorySteleSeen\(activeStory\)\.catch\(\(\)=>\{\}\);setSteleOpen\(true\);\}/);
});

test('Story Stele animation and text fitting are bounded and frame-driven',()=>{
  assert.match(pathScreen,/requestAnimationFrame\(autoScrollTick\)/);
  assert.doesNotMatch(pathScreen,/setInterval\(/);
  assert.match(pathScreen,/fitPassRef\.current>=1/);
  assert.match(pathScreen,/STELE_MIN_BODY_FONT_SIZE=12\.5/);
});

test('Path keeps only catalog diamonds interactive on the route scale',()=>{
  assert.match(pathScreen,/if\(part\.type==='diamond'\)\{\s*return <Pressable/);
  assert.match(pathScreen,/if\(part\.type==='section'\)return <View pointerEvents="none"/);
  assert.match(pathScreen,/return <View pointerEvents="none" key=\{part\.key\} style=\{\[styles\.scaleDot/);
});

test('Path restores the Web floating Guide trigger without overlapping Story Words',()=>{
  assert.match(pathScreen,/GuideHelpButton onPress=\{startGuide\}/);
  assert.doesNotMatch(pathScreen,/HeaderCircleButton/);
  assert.match(pathScreen,/wordListFloat:\{[^}]*left:10[^}]*top:'80%'[^}]*marginTop:-64/s);
  assert.match(pathScreen,/steleTrigger:\{[^}]*right:8[^}]*top:'80%'[^}]*marginTop:-31/s);
  assert.match(pathScreen,/storyTabs:\{[^}]*paddingHorizontal:0[^}]*gap:theme\.chrome\.storyTabs\.gap/s);assert.match(pathScreen,/storyTabFirst:\{marginLeft:theme\.chrome\.storyTabs\.edgeInset\}/);assert.match(pathScreen,/storyTabLast:\{marginRight:theme\.chrome\.storyTabs\.edgeInset\}/);
  assert.match(pathScreen,/scrollToStory=\(type,animated=true\)=>new Promise/);
  assert.match(pathScreen,/storyEdgeStart/);
  assert.match(pathScreen,/storyEdgeEnd/);
});

test('Route scale diamonds jump to measured catalog positions rather than percentage guesses',()=>{
  assert.match(pathScreen,/targetY:catalogLayout\?\.y\|\|0/);
  assert.match(pathScreen,/const jumpScale=\(part\)=>\{const viewport=viewportHeightRef\.current\|\|1,target=Math\.max\(0,\(Number\(part\?\.targetY\)\|\|0\)-viewport\*\.16\)/);
});

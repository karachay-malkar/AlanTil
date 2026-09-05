import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const mobile=path.resolve(here,'..');
const read=(file)=>fs.readFileSync(path.join(mobile,file),'utf8');
const pathScreen=read('screens/path.js');
const guide=read('ui/guide.js');
const guideState=read('platform/guide-state.js');
const station=read('screens/station.js');
const learn=read('screens/learn.js');
const components=read('ui/components.js');
const icons=read('ui/icons.js');
const appRoot=read('AppRoot.js');
const profileGate=read('screens/profile-gate.js');
const profileMain=read('screens/profile-main.js');
const visual=read('ui/web-visual-source.js');

test('Path guide uses the Web floating question trigger and story-specific targets',()=>{
  assert.match(pathScreen,/GuideHelpButton onPress=\{startGuide\}/);
  assert.doesNotMatch(pathScreen,/InfoIcon|HeaderCircleButton/);
  assert.match(pathScreen,/storyTargetRefs\.get\(currentGuide\.story\)/);
  assert.match(pathScreen,/currentGuide\?\.id\?\.startsWith\('story:'\)\?'pill'/);
  assert.match(pathScreen,/currentGuide\?\.id==='stages'\?'circle'/);
  assert.match(pathScreen,/selectVisibleGuideStation/);
  assert.match(pathScreen,/setSteleOpen\(false\);beginNativeGeneralGuide\(\)/);
});

test('general guide continuation is runtime-only and no longer persists station_pending',()=>{
  assert.doesNotMatch(guideState,/station_pending/);
  assert.match(guideState,/let generalRuntime=\{active:false,phase:'',storyIndex:0\}/);
  assert.match(guideState,/beginNativeGeneralGuide/);
  assert.match(guideState,/resetNativeGeneralGuideRuntime/);
  assert.match(pathScreen,/phase:'await-station'/);
  assert.match(station,/runtime\.active&&\(runtime\.phase==='station-study'\|\|runtime\.phase==='await-station'\)/);
});

test('Guide overlay mirrors Web shade, shapes, pulsing halo and glass panel',()=>{
  assert.match(guide,/GUIDE_SHADE='rgba\(25,25,25,\.54\)'/);
  assert.match(guide,/shape==='circle'\|\|hole\.shape==='pill'/);
  assert.match(guide,/Array\.isArray\(targets\)/);
  assert.match(guide,/duration:1075/);
  assert.match(guide,/GlassBackdrop blur=\{14\}/);
  assert.match(guide,/GUIDE_PANEL='rgba\(246,242,233,\.94\)'/);
  assert.match(guide,/avoidBottomNav\?height-\(insets\.bottom\+theme\.control\.nav\+theme\.chrome\.contentRestGap\)/);
});

test('learning guide uses multi-target decision, counter pill and favorite circle',()=>{
  assert.match(learn,/guideTargets=currentGuide\?\.id==='decision'\?\[\{ref:cardTarget,shape:'rounded',padding:7\},\{ref:decisionTarget,shape:'rounded',padding:10,minWidth:178,minHeight:84\}\]/);
  assert.match(learn,/currentGuide\?\.id==='counter'\?counterTarget/);
  assert.match(learn,/currentGuide\?\.id==='favorite'\?'circle'/);
  assert.match(learn,/targetRef:counterTarget/);
});

test('BottomNav overlays content and owns the bottom safe area instead of reserving a panel',()=>{
  assert.match(visual,/shellEdges:\['top','left','right'\]/);
  assert.match(visual,/bottomManagedByChrome:true/);
  assert.match(appRoot,/edges=\{theme\.safeArea\.shellEdges\}/);
  assert.match(components,/height:theme\.control\.nav\+insets\.bottom/);
  assert.match(components,/paddingBottom:insets\.bottom/);
  assert.match(components,/export function Screen\(\{children,bottomNav=false\}\)\{return <View style=\{s\.screen\}>/);
  assert.match(pathScreen,/pathViewport:\{position:'absolute',top:0,left:0,right:0,bottom:0\}/);
  assert.match(pathScreen,/paddingBottom:insets\.bottom\+theme\.control\.nav\+theme\.chrome\.contentRestGap/);
});

test('BottomNav uses the exact Web practice/profile outline glyphs and bubble treatment',()=>{
  assert.match(icons,/m6\.5 6\.5 11 11M21 21l-1-1M3 3l1 1M18 22l4-4M2 6l4-4M3 10l7-7M14 21l7-7/);
  assert.match(icons,/<Circle cx="12" cy="8" r="5"/);
  assert.match(icons,/M20 21a8 8 0 0 0-16 0/);
  assert.match(components,/shadowOpacity:\.018/);
  assert.match(components,/navLabelActive:\{color:C\.text1\}/);
});

test('Profile child settings screens explicitly hide the global BottomNav',()=>{
  assert.match(profileGate,/onBottomNavVisibilityChange/);
  assert.match(profileMain,/onBottomNavVisibilityChange\?\.\(!child\)/);
  assert.match(appRoot,/showNav=profileBottomNavVisible/);
});

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),mobile=path.resolve(here,'..'),root=path.resolve(mobile,'..');
const m=(file)=>fs.readFileSync(path.join(mobile,file),'utf8'),w=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const sharedTokens=w('packages/alantil-ui/tokens.js'),sharedChrome=w('packages/alantil-ui/chrome.js');
const visual=m('ui/web-visual-source.js'),components=m('ui/components.js'),checkbox=m('ui/checkbox.js'),parity=m('ui/parity.js'),modal=m('ui/modal.js'),guide=m('ui/guide.js'),pathScreen=m('screens/path.js'),setPrep=m('ui/set-preparation.js'),settingsChild=m('screens/settings-child.js'),stationTest=m('screens/station-test.js'),practiceGames=m('screens/practice-games.js'),learn=m('screens/learn.js'),webTheme=w('src/shared/styles/theme.css'),webShell=w('src/shared/styles/shell.css'),webChrome=w('src/shared/styles/chrome.css'),webComponents=w('src/shared/styles/components.css'),webPathNav=w('src/features/path/path-navigation.css');

test('Mobile system UI consumes final Web cascade instead of the early theme default',()=>{
  assert.match(webTheme,/--header-h:46px/);
  assert.match(webShell,/--header-h:42px/);
  assert.match(sharedTokens,/control:Object\.freeze\([^\n]*header:42/);
  assert.match(webShell,/appHeaderAction[\s\S]*width:var\(--ui-header-action-size\);[\s\S]*backdrop-filter:blur\(var\(--ui-system-control-blur\)\)/);
  assert.match(webChrome,/\.btn\{border-radius:var\(--ui-button-radius\);box-shadow:0 3px 12px/);
});

test('Web controls use one platform-aware glass layer and never nest Expo BlurView in chrome buttons',()=>{
  assert.match(components,/export function GlassBackdrop/);
  assert.match(components,/Platform\.OS==='web'/);
  assert.match(components,/backdropFilter:`blur\(\$\{blur\}px\)/);
  assert.match(components,/import\{ChromeMask\}from'\.\/chrome-mask'/);
  const nativeChrome=fs.readFileSync(path.join(mobile,'ui/chrome-mask.native.js'),'utf8');
  assert.match(nativeChrome,/MaskedView/);
  assert.doesNotMatch(nativeChrome,/ChromeBlurStrip|levels=6/);
  assert.doesNotMatch(components,/HeaderCircleButton[\s\S]{0,900}<BlurView/);
  assert.doesNotMatch(components,/HeaderTextAction[\s\S]{0,900}<BlurView/);
  assert.match(components,/HeaderCircleButton[\s\S]{0,800}<GlassBackdrop/);
  assert.match(components,/BottomNav[\s\S]{0,1800}Platform\.OS==='web'\?<GlassBackdrop\/>:null/);
});

test('Guide story steps center the exact story before rendering a target-dependent panel',()=>{
  assert.match(webPathNav,/storyTabs[\s\S]*scroll-snap-type:x proximity/);
  assert.match(pathScreen,/scrollToStory=\(type,animated=true\)=>new Promise/);
  assert.match(pathScreen,/layout\.x\+layout\.width\/2-viewport\/2/);
  assert.match(pathScreen,/await storyTabsControlRef\.current\?\.scrollToStory\?\.\(next\.story,true\)/);
  assert.match(pathScreen,/paddingHorizontal:0,gap:theme\.chrome\.storyTabs\.gap/);
  assert.match(pathScreen,/storyEdgeStart/);
  assert.match(pathScreen,/storyEdgeEnd/);
  assert.match(guide,/targetExpected=targetDefs\.some/);
  assert.match(guide,/opacity:targetExpected&&!holes\.length\?0:1/);
});

test('Checkboxes preserve both Web checkbox vocabularies: native accent and bracket word toggles',()=>{
  assert.match(webComponents,/contentListCheckbox,.scopeCheckbox\{width:18px;height:18px[\s\S]*accent-color:var\(--accent\)/);
  assert.match(webComponents,/bracketCheckboxMark::before\{content:"\[ \]"/);
  assert.match(checkbox,/variant='native'/);
  assert.match(checkbox,/variant==='bracket'/);
  assert.match(checkbox,/backgroundColor:C\.accent/);
  assert.match(checkbox,/color=\{C\.inverse\}/);
  assert.match(checkbox,/\[ \]/);
  assert.match(setPrep,/variant="bracket"/);
  assert.match(settingsChild,/<Checkbox size=\{20\}/);
});

test('Segmented controls expose the final per-feature active surfaces',()=>{
  assert.match(sharedTokens,/settingsActiveAlpha:\.72/);
  assert.match(sharedTokens,/setActiveAlpha:\.82/);
  assert.match(sharedTokens,/testActiveAlpha:\.86/);
  assert.match(sharedTokens,/songsActiveAlpha:\.84/);
  assert.match(parity,/segmentItemActive:\s*\{[^}]*backgroundColor:\s*'rgba\(246,242,233,\.72\)'/s);
  assert.match(parity,/segmentItemSetActive:\s*\{[^}]*backgroundColor:\s*'rgba\(246,242,233,\.82\)'/s);
  assert.match(parity,/segmentItemTestActive:\s*\{[^}]*backgroundColor:\s*'rgba\(246,242,233,\.86\)'/s);
  assert.match(parity,/segmentItemSongsActive:\s*\{[^}]*backgroundColor:\s*'rgba\(246,242,233,\.84\)'/s);
});

test('Modal and Guide glass match final Web chrome without a second blur primitive',()=>{
  assert.match(webChrome,/modal,.exitModalCard[\s\S]*border-radius:22px[\s\S]*surface-0\) 92%[\s\S]*blur\(20px\) saturate\(1\.05\)/);
  assert.match(modal,/MODAL_SURFACE='rgba\(246,242,233,\.92\)'/);
  assert.match(modal,/GlassBackdrop blur=\{20\} saturate=\{1\.05\} backgroundColor=\{MODAL_SURFACE\}/);
  assert.doesNotMatch(modal,/BlurView/);
  assert.match(guide,/GlassBackdrop blur=\{14\}/);
  assert.doesNotMatch(guide,/BlurView/);
});

test('Test option visuals and Learn icon action geometry use the shared Web interaction vocabulary',()=>{
  assert.match(components,/export function OptionChoice/);
  assert.match(stationTest,/<OptionChoice/);
  assert.match(practiceGames,/<OptionChoice/);
  assert.match(practiceGames,/selected\|\|wrong\?<CutCornerFrame fill="transparent"/);
  assert.match(learn,/cardAction:\{minWidth:40,minHeight:40,padding:8/);
});

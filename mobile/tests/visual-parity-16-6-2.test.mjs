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
const pathScreen=readMobile('screens/path.js');
const app=JSON.parse(readMobile('app.json'));
const pkg=JSON.parse(readMobile('package.json'));
const webTheme=readRoot('src/shared/styles/theme.css');
const webChrome=readRoot('src/shared/styles/chrome.css');
const webPath=readRoot('src/features/path/path.css');

test('16.6.2 release metadata is coherent',()=>{
  assert.equal(app.expo.version,'16.6.2');
  assert.equal(pkg.version,'16.6.2');
  assert.equal(app.expo.extra.releaseVersion,'16.6.2');
  assert.equal(app.expo.android.versionCode,25);
  assert.equal(app.expo.ios.buildNumber,'25');
});

test('16.6.2 canonical header token follows Web theme rather than Profile root override',()=>{
  assert.match(webTheme,/--header-h:46px/);
  assert.match(webChrome,/profileScroll[\s\S]*safe-top\) \+ 42px/);
  assert.match(visual,/header:46/);
  assert.match(theme,/path:W\.path/);
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

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {UI_TOKENS,VISUAL_CONTRACT_VERSION,WEB_VISUAL_REFERENCE} from '../packages/alantil-ui/tokens.js';
import {CHROME_CONTRACT} from '../packages/alantil-ui/chrome.js';
import {CONTROL_LAYOUT} from '../packages/alantil-ui/control-layout.js';
import {SCREEN_VISUAL_BINDINGS} from '../packages/alantil-ui/screen-bindings.js';
import {WEB_VISUAL_SOURCES,verifyWebVisualSourceManifest} from '../mobile/ui/web-visual-source.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file)=>fs.readFileSync(path.join(ROOT,file),'utf8');
const blobSha=(file)=>{const content=fs.readFileSync(path.join(ROOT,file));return crypto.createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');};

test('16.7 visual contract is current and covers every root feature',()=>{
  assert.equal(VISUAL_CONTRACT_VERSION,'16.7.0');
  assert.equal(WEB_VISUAL_REFERENCE,'16.7.0');
  for(const screen of ['practice','friends','ashyk','account','admin']) assert.ok(SCREEN_VISUAL_BINDINGS[screen],`missing visual binding: ${screen}`);
  assert.equal(CHROME_CONTRACT.bottomNav.bubbleSize,38);
  assert.equal(CHROME_CONTRACT.bottomNav.compactBubbleSize,36);
  assert.equal(CHROME_CONTRACT.bottomNav.side,12);
  assert.equal(CHROME_CONTRACT.bottomNav.compactSide,8);
  assert.equal(CHROME_CONTRACT.bottomNav.labelSize,10);
  assert.equal(CHROME_CONTRACT.bottomNav.compactLabelSize,9);
  assert.equal(CHROME_CONTRACT.bottomNav.gap,2);
  assert.deepEqual(CONTROL_LAYOUT.practice,{rowHeight:68,singleRowHeight:58,leadingSize:36,iconSize:23,gap:10,titleSize:15,subtitleSize:11});
  assert.equal(CONTROL_LAYOUT.social.rowHeight,52);
  assert.equal(CONTROL_LAYOUT.social.rankWidth,30);
  assert.equal(CONTROL_LAYOUT.social.actionSize,34);
  assert.equal(CONTROL_LAYOUT.social.compactActionSize,32);
  assert.equal(UI_TOKENS.ashyk.buttonHeight,38);
  assert.equal(UI_TOKENS.ashyk.buttonRadius,14);
});

test('Web consumes Friends, Practice, navigation and Ashyk from the shared contract',()=>{
  const app=read('src/shared/styles/app.css');
  const html=read('index.html');
  const friends=read('src/features/friends/friends-16-7.css');
  const practice=read('src/features/practice/practice.css');
  const ashyk=read('src/features/ashyk/ashyk.css');
  const tokens=read('src/shared/styles/shared-visual-tokens.css');
  assert.match(app,/friends\/friends-16-7\.css\?v=16\.7\.0[^\n]*layer\(features\)/);
  assert.doesNotMatch(html,/friends-16-7\.css/);
  for(const name of ['--ui-social-row-height:52px','--ui-social-rank-width:30px','--ui-social-action-size:34px','--ui-social-compact-action-size:32px','--ui-practice-row-height:68px','--ui-practice-single-row-height:58px','--ui-ashyk-button-height:38px','--ui-bottom-nav-bubble-size:38px']) assert.match(tokens,new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(friends,/min-height:var\(--ui-social-row-height\)/);
  assert.match(friends,/width:var\(--ui-social-rank-width\)/);
  assert.match(friends,/width:var\(--ui-social-action-size\)/);
  assert.match(friends,/width:var\(--ui-social-compact-action-size\)/);
  assert.match(practice,/min-height:var\(--ui-practice-row-height\)/);
  assert.match(practice,/min-height:var\(--ui-practice-single-row-height\)/);
  assert.match(app,/width:var\(--ui-bottom-nav-bubble-size\)/);
  assert.match(ashyk,/min-height:var\(--ui-ashyk-button-height\)/);
  assert.match(ashyk,/border-radius:var\(--ui-ashyk-button-radius\)/);
});

test('Mobile consumes shared BottomNav, bracket tabs, Friends and Practice geometry',()=>{
  const nav=read('mobile/ui/social-bottom-nav.js');
  const tabs=read('mobile/ui/profile-tabs.js');
  const friends=read('mobile/screens/friends.js');
  const practice=read('mobile/screens/practice.js');
  assert.match(nav,/theme\.chrome\.bottomNav/);
  assert.match(nav,/nav\.compactBubbleSize/);
  assert.match(nav,/nav\.bubbleSize/);
  assert.doesNotMatch(nav,/bubble:\{width:34,height:34/);
  assert.match(tabs,/theme\.chrome\.profileTabs/);
  assert.doesNotMatch(friends,/textSize=\{type\.caption\.fontSize\}/);
  assert.match(friends,/CONTROL_LAYOUT\.social\.rowHeight/);
  assert.match(friends,/CONTROL_LAYOUT\.social\.rankWidth/);
  assert.match(friends,/CONTROL_LAYOUT\.social\.actionSize/);
  assert.match(practice,/P=CONTROL_LAYOUT\.practice/);
  assert.match(practice,/minHeight:P\.rowHeight/);
  assert.match(practice,/minHeight:P\.singleRowHeight/);
  assert.match(practice,/width:P\.leadingSize/);
});

test('Ashyk UI consumes shared visual geometry without changing game modules',()=>{
  const mobileTheme=read('mobile/ui/theme.js');
  const mobileAshyk=read('mobile/screens/ashyk.js');
  assert.match(mobileTheme,/ashyk:W\.ashyk/);
  assert.match(mobileAshyk,/theme\.ashyk\.buttonHeight/);
  assert.match(mobileAshyk,/theme\.ashyk\.buttonRadius/);
  assert.match(mobileAshyk,/theme\.ashyk\.segmentedHeight/);
  assert.doesNotMatch(mobileAshyk,/ashykButton:\{width:'100%',minHeight:38,paddingVertical:7,paddingHorizontal:13/);
});

test('Web visual manifest is complete and every recorded blob SHA matches current 16.7 source',()=>{
  const audit=verifyWebVisualSourceManifest();
  assert.equal(audit.ref,'16.7.0');
  assert.equal(audit.complete,true);
  assert.deepEqual(audit.missingCoverage,[]);
  const groups=[WEB_VISUAL_SOURCES.styles,WEB_VISUAL_SOURCES.ui,WEB_VISUAL_SOURCES.account,WEB_VISUAL_SOURCES.features];
  for(const entries of groups)for(const [file,expected] of entries)assert.equal(blobSha(file),expected,`stale visual manifest SHA: ${file}`);
  const featurePaths=new Set(WEB_VISUAL_SOURCES.features.map(([file])=>file));
  for(const required of ['src/features/practice/practice.css','src/features/friends/friends-16-7.css','src/features/ashyk/ashyk.css','src/features/admin/admin.css'])assert.ok(featurePaths.has(required),`missing manifest source ${required}`);
});

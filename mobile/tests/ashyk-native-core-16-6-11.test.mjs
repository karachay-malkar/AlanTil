import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';
import path from'node:path';
import{fileURLToPath}from'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const exists=p=>fs.existsSync(path.join(ROOT,p));

test('Practice opens native Ashyk screen with no WebView or HTML runtime',()=>{const app=read('mobile/AppRoot.js'),practice=read('mobile/screens/practice.js'),screen=read('mobile/screens/ashyk.js'),pkg=read('mobile/package.json'),metro=read('mobile/metro.config.js');assert.match(app,/AshykScreen/);assert.match(app,/screen==='ashyk'/);assert.match(app,/openAshyk=\{\(\)=>setScreen\('ashyk'\)\}/);assert.match(practice,/title=\{ashyk\.title\}/);assert.doesNotMatch(practice,/ashyk.*subtitle/i);assert.match(screen,/AshykNativeScene/);assert.match(screen,/createAshykGameStore/);assert.match(screen,/createAshykOnlineAdapter/);assert.doesNotMatch(screen,/WebView|iframe|\.html|appdeploy/i);assert.doesNotMatch(pkg,/react-native-webview/);assert.doesNotMatch(metro,/assetExts.*html/);assert.equal(exists('mobile/assets/ashyk-game/index.html'),false);});

test('Mobile uses shared engine rules constants vocabulary and native renderer only',()=>{const scene=read('mobile/game/ashyk-scene.js'),screen=read('mobile/screens/ashyk.js');assert.match(scene,/packages\/ashyk-game\/model\/index\.js/);assert.match(scene,/createAshykVisual/);assert.match(screen,/packages\/ashyk-game\/engine\.js/);assert.match(screen,/packages\/ashyk-game\/store\.js/);assert.doesNotMatch(screen,/function evaluateCapture|function planComputerShot|FACE_DEFS\s*=/);});

test('Mobile audio is local and consumes shared engine impact lifecycle',()=>{const audio=read('mobile/game/ashyk-audio.js'),engine=read('packages/ashyk-game/engine.js');for(const p of['mobile/assets/ashyk/audio/clack.mp3','mobile/assets/ashyk/audio/smaller-horn-dropped-on-stone-floor.mp3','mobile/assets/ashyk/audio/wood-hard-hit.wav'])assert.ok(exists(p),p);assert.match(audio,/createAudioPlayer/);assert.match(audio,/grounded/);assert.match(audio,/linearSpeed/);assert.match(audio,/angularSpeed/);assert.match(audio,/cooldown/);assert.match(audio,/release\(\)/);assert.match(engine,/emit\('impact'/);assert.match(engine,/emit\('rolling'/);assert.match(engine,/grounded:grounded\.has/);});

test('Native screen uses Alan Til Header, setup SegmentedControl and compact shot icons',()=>{const screen=read('mobile/screens/ashyk.js');assert.match(screen,/<Header title=\{m\.title\} onBack=/);assert.match(screen,/SegmentedControl/);assert.match(screen,/m\.modeLabel/);assert.match(screen,/m\.difficultyLabel/);assert.match(screen,/ShotControls/);assert.match(screen,/kind="tap"/);assert.match(screen,/kind="flat"/);assert.match(screen,/kind="hop"/);assert.match(screen,/m\.top/);assert.match(screen,/m\.orbit/);assert.doesNotMatch(screen,/>\{m\.shotType\}</);});

test('Online room cleanup is present on screen disposal',()=>{const screen=read('mobile/screens/ashyk.js'),online=read('packages/ashyk-game/online.js');assert.match(screen,/online\.leaveRoom\(room\.id\)/);assert.match(screen,/unsubscribeRoom\.current\?\.\(\)/);assert.match(online,/p_expected_revision/);assert.match(online,/postgres_changes/);});

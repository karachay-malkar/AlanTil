import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const read=(relative)=>fs.readFileSync(path.join(root,relative),'utf8');
const exists=(relative)=>fs.existsSync(path.join(root,relative));

test('Ashyk game renderer has a shared internal integration contract',()=>{
  const shared=read('packages/alantil-core/ashyk-game.js');
  assert.match(shared,/ASHYK_GAME_RENDERER_URL/);
  assert.match(shared,/https:\/\/3d-5lcon9\.v2\.appdeploy\.ai\//);
  assert.equal(exists('packages/alantil-core/external-games.js'),false);
});

test('mobile Practice opens Ashyk as an application screen instead of a browser',()=>{
  const app=read('mobile/AppRoot.js');
  const practice=read('mobile/screens/practice.js');
  const nativeGame=read('mobile/screens/ashyk-game.native.js');
  assert.match(app,/screen==='ashyk'/);
  assert.match(app,/AshykGameScreen/);
  assert.match(app,/setScreen\('ashyk'\)/);
  assert.doesNotMatch(app,/WebBrowser\.openBrowserAsync/);
  assert.doesNotMatch(app,/OSUYAT_URL/);
  assert.match(practice,/title="Ашыкъ оюн"/);
  assert.match(practice,/AshykIcon/);
  assert.doesNotMatch(practice,/OSUYAT_MARK/);
  assert.doesNotMatch(practice,/title="osuyat"[^\n]*onPress=\{openAshyk\}/);
  assert.match(nativeGame,/react-native-webview/);
  assert.match(nativeGame,/Header title="Ашыкъ оюн" onBack=\{onBack\}/);
});

test('web Practice embeds Ashyk inside the application shell',()=>{
  const practice=read('src/features/practice/index.js');
  const screens=read('src/app/screen-registry.js');
  assert.match(practice,/data-practice-ashyk/);
  assert.match(practice,/context\.router\.navigate\("practice\.home", \{ section: "ashyk" \}\)/);
  assert.match(practice,/context\.shell\.configureScreen\?\.\("practice\.ashyk"\)/);
  assert.match(practice,/class="ashykGameFrame"/);
  assert.match(practice,/ASHYK_GAME_RENDERER_URL/);
  assert.doesNotMatch(practice,/window\.open/);
  assert.doesNotMatch(practice,/OSUYAT_URL/);
  assert.match(screens,/"practice\.ashyk"/);
  assert.match(screens,/title: "Ашыкъ оюн"/);
});

test('mobile product branding is osuyat while compatibility identifiers stay intact',()=>{
  const config=JSON.parse(read('mobile/app.json'));
  const app=read('mobile/AppRoot.js');
  assert.equal(config.expo.name,'osuyat');
  assert.equal(config.expo.slug,'osuyat');
  assert.equal(config.expo.version,'16.6.8');
  assert.equal(config.expo.icon,'./assets/osuyat.png');
  assert.equal(config.expo.splash.image,'./assets/osuyat.png');
  assert.equal(config.expo.android.adaptiveIcon.foregroundImage,'./assets/osuyat.png');
  assert.equal(config.expo.android.package,'app.alantil.mobile');
  assert.equal(config.expo.scheme,'alantil');
  assert.match(app,/bootBrand>osuyat</);
  assert.ok(exists('mobile/assets/osuyat.png'));
});

test('web shell has no visible Alan Til or osuyat product title',()=>{
  const html=read('index.html');
  assert.doesNotMatch(html,/<title>\s*Alan\s*Til/i);
  assert.doesNotMatch(html,/content="AlanTil/);
  assert.match(html,/cleanProductTitle/);
  assert.match(html,/practice\/practice\.css\?v=16\.6\.8/);
});

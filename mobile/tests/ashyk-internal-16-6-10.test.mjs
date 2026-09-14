import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';

const practice=fs.readFileSync(new URL('../screens/practice.js',import.meta.url),'utf8');
const appRoot=fs.readFileSync(new URL('../AppRoot.js',import.meta.url),'utf8');
const gamePath=new URL('../assets/ashyk-game/index.html',import.meta.url);
const webGamePath=new URL('../../assets/ashyk-game/index.html',import.meta.url);
const packageJson=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const appJson=JSON.parse(fs.readFileSync(new URL('../app.json',import.meta.url),'utf8'));
const hash=(bytes)=>crypto.createHash('sha256').update(bytes).digest('hex');

test('mobile Practice loads the repository-owned Ashyk runtime from the APK',()=>{
  assert.match(practice,/react-native-webview/);
  assert.match(practice,/require\('\.\.\/assets\/ashyk-game\/index\.html'\)/);
  assert.match(practice,/title="Ашыкъ оюн"/);
  assert.match(practice,/getNativeAuthSession/);
  assert.match(practice,/subscribeNativeAuth/);
  assert.match(practice,/ashyk-auth-request/);
  assert.match(practice,/alantil-auth/);
  assert.doesNotMatch(practice,/appdeploy\.ai/i);
  assert.match(appRoot,/PracticeScreen/);
  const mobile=fs.readFileSync(gamePath),web=fs.readFileSync(webGamePath);
  assert.equal(hash(mobile),hash(web),'APK and web must use identical Ashyk runtime bytes');
});

test('16.6.10 keeps the WebView dependency and release bump',()=>{
  assert.equal(packageJson.version,'16.6.10');
  assert.equal(packageJson.dependencies['react-native-webview'],'13.15.0');
  assert.equal(appJson.expo.version,'16.6.10');
  assert.equal(appJson.expo.android.versionCode,35);
  assert.equal(appJson.expo.ios.buildNumber,'35');
  assert.equal(appJson.expo.extra.releaseVersion,'16.6.10');
});
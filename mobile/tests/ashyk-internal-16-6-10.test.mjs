import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const practice=fs.readFileSync(new URL('../screens/practice.js',import.meta.url),'utf8');
const metro=fs.readFileSync(new URL('../metro.config.js',import.meta.url),'utf8');
const packageJson=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const appJson=JSON.parse(fs.readFileSync(new URL('../app.json',import.meta.url),'utf8'));

test('mobile Practice loads Ashyk from an APK asset instead of AppDeploy',()=>{
  assert.match(practice,/react-native-webview/);
  assert.match(practice,/expo-asset/);
  assert.match(practice,/require\('\.\.\/assets\/ashyk-game\/index\.html'\)/);
  assert.doesNotMatch(practice,/appdeploy\.ai/i);
  assert.match(practice,/getNativeAuthSession/);
  assert.match(practice,/subscribeNativeAuth/);
  assert.match(practice,/ashyk-auth-request/);
  assert.match(practice,/alantil-auth/);
  assert.match(metro,/assetExts\.includes\('html'\)/);
  assert.ok(fs.statSync(new URL('../assets/ashyk-game/index.html',import.meta.url)).size>100000);
});

test('16.6.10 mobile release keeps WebView but makes the game local',()=>{
  assert.equal(packageJson.version,'16.6.10');
  assert.equal(packageJson.dependencies['react-native-webview'],'13.15.0');
  assert.equal(appJson.expo.version,'16.6.10');
  assert.equal(appJson.expo.android.versionCode,35);
  assert.equal(appJson.expo.ios.buildNumber,'35');
  assert.equal(appJson.expo.extra.releaseVersion,'16.6.10');
});

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const practice=fs.readFileSync(new URL('../screens/practice.js',import.meta.url),'utf8');
const packageJson=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const appJson=JSON.parse(fs.readFileSync(new URL('../app.json',import.meta.url),'utf8'));

test('mobile Practice embeds Ashyk in a native full-screen WebView',()=>{
  assert.match(practice,/react-native-webview/);
  assert.match(practice,/title="Ашыкъ оюн"/);
  assert.match(practice,/Modal visible=\{gameOpen\}/);
  assert.match(practice,/getNativeAuthSession/);
  assert.match(practice,/subscribeNativeAuth/);
  assert.match(practice,/ashyk-auth-request/);
  assert.match(practice,/alantil-auth/);
});

test('16.6.9 mobile release includes the WebView dependency and build bump',()=>{
  assert.equal(packageJson.version,'16.6.9');
  assert.equal(packageJson.dependencies['react-native-webview'],'13.15.0');
  assert.equal(appJson.expo.version,'16.6.9');
  assert.equal(appJson.expo.android.versionCode,34);
  assert.equal(appJson.expo.ios.buildNumber,'34');
  assert.equal(appJson.expo.extra.releaseVersion,'16.6.9');
});

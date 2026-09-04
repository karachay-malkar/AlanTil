import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const mobile=path.resolve(here,'..');
const read=(file)=>fs.readFileSync(path.join(mobile,file),'utf8');
const onboarding=read('screens/onboarding.js');
const authChoice=read('screens/auth-choice.js');
const auth=read('platform/auth.js');
const pathScreen=read('screens/path.js');
const app=JSON.parse(read('app.json'));
const pkg=JSON.parse(read('package.json'));

test('16.6.3 first-run setup is one progressively disclosed screen with Web geometry',()=>{
  assert.match(onboarding,/maxWidth:560/);
  assert.match(onboarding,/DisclosureSection/);
  assert.match(onboarding,/LanguageSegmentedControl/);
  assert.match(onboarding,/FlagIcon/);
  assert.match(onboarding,/height\*\.29/);
  assert.match(onboarding,/short\?190:compact\?220/);
  assert.match(onboarding,/copy\.continue/);
  assert.doesNotMatch(onboarding,/setStep\(|progressCell/);
});

test('16.6.3 auth choice is direct and Google OAuth is app-returning, persistent and idempotent',()=>{
  assert.match(authChoice,/continueGoogle/);
  assert.match(authChoice,/prodolzhit_kak_gost/);
  assert.match(authChoice,/GoogleMark/);
  assert.match(auth,/NATIVE_AUTH_REDIRECT_URL='alantil:\/\/auth\/callback'/);
  assert.match(auth,/WebBrowser\.openAuthSessionAsync\(authorize\.toString\(\),NATIVE_AUTH_REDIRECT_URL\)/);
  assert.match(auth,/oauthFlowPromise/);
  assert.match(auth,/callbackPromise/);
  assert.match(auth,/lastHandledCallbackUrl/);
  assert.match(auth,/AsyncStorage\.setItem\(SESSION_KEY,JSON\.stringify\(currentSession\)\)/);
  assert.match(auth,/refreshNativeAuthSession/);
  assert.match(pkg.dependencies['expo-web-browser'],/^~15\.0\.11$/);
  assert.ok(app.expo.plugins.some((entry)=>Array.isArray(entry)&&entry[0]==='expo-web-browser'));
  assert.equal(app.expo.android.versionCode,27);
  assert.equal(app.expo.ios.buildNumber,'27');
});

test('16.6.3 Story Stele matches Web viewport and overflow behavior',()=>{
  assert.match(pathScreen,/height\*\.53,932/);
  assert.match(pathScreen,/STELE_AUTO_SCROLL_START_DELAY=1600/);
  assert.match(pathScreen,/STELE_AUTO_SCROLL_RESUME_DELAY=2600/);
  assert.match(pathScreen,/STELE_AUTO_SCROLL_PX_PER_SECOND=7/);
  assert.match(pathScreen,/STELE_MIN_BODY_FONT_SIZE=12\.5/);
  assert.match(pathScreen,/STELE_MIN_LINE_HEIGHT=1\.32/);
  assert.match(pathScreen,/AccessibilityInfo\.isReduceMotionEnabled/);
  assert.doesNotMatch(pathScreen,/scrollToEnd\(\{animated:true\}\)/);
});

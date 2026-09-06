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
const authFacade=read('platform/auth.js');
const nativeAuth=read('platform/auth.native.js');
const webAuth=read('platform/auth.web.js');
const nativeSupabase=read('platform/supabase.native.js');
const webSupabase=read('platform/supabase.web.js');
const appRoot=read('AppRoot.js');
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

test('16.6.3 auth choice resolves separate Native and Web PKCE callbacks',()=>{
  assert.match(authChoice,/continueGoogle/);
  assert.match(authChoice,/prodolzhit_kak_gost/);
  assert.match(authChoice,/GoogleMark/);
  assert.match(appRoot,/from '.\/platform\/auth\.js'/);
  assert.match(authFacade,/Platform\.OS==='web'\?require\('.\/auth\.web\.js'\):require\('.\/auth\.native\.js'\)/);
  assert.match(nativeAuth,/NATIVE_AUTH_REDIRECT_URL='alantil:\/\/auth\/callback'/);
  assert.match(nativeSupabase,/createClient\(/);
  assert.match(nativeSupabase,/flowType:'pkce'/);
  assert.match(nativeSupabase,/appendPkceFlowIdToRedirects:true/);
  assert.match(nativeSupabase,/storage:AsyncStorage/);
  assert.match(nativeSupabase,/persistSession:true/);
  assert.match(nativeSupabase,/detectSessionInUrl:false/);
  assert.match(nativeAuth,/nativeSupabase\.auth\.signInWithOAuth\(/);
  assert.match(nativeAuth,/redirectTo:NATIVE_AUTH_REDIRECT_URL/);
  assert.match(nativeAuth,/skipBrowserRedirect:true/);
  assert.match(nativeAuth,/WebBrowser\.openAuthSessionAsync\(data\.url,NATIVE_AUTH_REDIRECT_URL/);
  assert.match(nativeAuth,/nativeSupabase\.auth\.exchangeCodeForSession\(params\.code,options\)/);
  assert.match(nativeAuth,/Linking\.getInitialURL\(\)/);
  assert.doesNotMatch(nativeAuth,/alantil\.ru/);

  assert.match(webSupabase,/createClient\(/);
  assert.match(webSupabase,/flowType:'pkce'/);
  assert.match(webSupabase,/browserStorage/);
  assert.match(webSupabase,/persistSession:true/);
  assert.match(webSupabase,/detectSessionInUrl:false/);
  assert.match(webAuth,/resolveWebAuthRedirectUrl/);
  assert.match(webAuth,/location\.origin/);
  assert.match(webAuth,/nativeSupabase\.auth\.signInWithOAuth\(/);
  assert.match(webAuth,/redirectTo,skipBrowserRedirect:true/);
  assert.match(webAuth,/window\.location\.assign\(data\.url\)/);
  assert.match(webAuth,/nativeSupabase\.auth\.exchangeCodeForSession\(params\.code,options\)/);
  assert.doesNotMatch(webAuth,/alantil:\/\/auth\/callback/);
  assert.doesNotMatch(webAuth,/WebBrowser\.openAuthSessionAsync/);
  assert.doesNotMatch(webAuth,/Linking\./);

  assert.equal(pkg.dependencies['@supabase/supabase-js'],'2.112.4');
  assert.match(pkg.dependencies['expo-web-browser'],/^~15\.0\.11$/);
  assert.ok(app.expo.plugins.some((entry)=>Array.isArray(entry)&&entry[0]==='expo-web-browser'));
  assert.equal(app.expo.scheme,'alantil');
  const filter=app.expo.android.intentFilters.find((entry)=>entry.action==='VIEW');
  assert.ok(filter);
  assert.ok(filter.category.includes('BROWSABLE'));
  assert.ok(filter.category.includes('DEFAULT'));
  assert.ok(filter.data.some((entry)=>entry.scheme==='alantil'&&entry.host==='auth'&&entry.pathPrefix==='/callback'));
  assert.equal(app.expo.android.versionCode,31);
  assert.equal(app.expo.ios.buildNumber,'31');
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

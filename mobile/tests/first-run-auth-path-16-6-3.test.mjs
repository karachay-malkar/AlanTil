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
const supabase=read('platform/supabase.js');
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

test('16.6.3 auth choice uses Supabase PKCE OAuth and returns only to the native callback',()=>{
  assert.match(authChoice,/continueGoogle/);
  assert.match(authChoice,/prodolzhit_kak_gost/);
  assert.match(authChoice,/GoogleMark/);
  assert.match(auth,/NATIVE_AUTH_REDIRECT_URL='alantil:\/\/auth\/callback'/);
  assert.match(supabase,/createClient\(/);
  assert.match(supabase,/flowType:'pkce'/);
  assert.match(supabase,/appendPkceFlowIdToRedirects:true/);
  assert.match(supabase,/storage:AsyncStorage/);
  assert.match(supabase,/persistSession:true/);
  assert.match(supabase,/detectSessionInUrl:false/);
  assert.match(auth,/nativeSupabase\.auth\.signInWithOAuth\(/);
  assert.match(auth,/redirectTo:NATIVE_AUTH_REDIRECT_URL/);
  assert.match(auth,/skipBrowserRedirect:true/);
  assert.match(auth,/WebBrowser\.openAuthSessionAsync\(data\.url,NATIVE_AUTH_REDIRECT_URL/);
  assert.match(auth,/nativeSupabase\.auth\.exchangeCodeForSession\(params\.code,options\)/);
  assert.match(auth,/read\('code'\)/);
  assert.match(auth,/nativeSupabase\.auth\.setSession\(\{access_token:params\.accessToken,refresh_token:params\.refreshToken\}\)/);
  assert.match(auth,/dismissAuthBrowser/);
  assert.match(auth,/restoreLegacySession/);
  assert.match(auth,/Linking\.getInitialURL\(\)/);
  assert.match(auth,/lastHandledCallbackUrl/);
  assert.match(auth,/nativeSupabase\.auth\.getSession\(\)/);
  assert.match(auth,/nativeSupabase\.auth\.signOut\(\{scope:'local'\}\)/);
  assert.match(auth,/AsyncStorage\.setItem\(SESSION_KEY,JSON\.stringify\(currentSession\)\)/);
  assert.match(auth,/refreshNativeAuthSession/);
  assert.doesNotMatch(auth,/\/auth\/v1\/authorize/);
  assert.doesNotMatch(auth,/alantil\.ru/);
  assert.equal(pkg.dependencies['@supabase/supabase-js'],'2.112.4');
  assert.match(pkg.dependencies['expo-web-browser'],/^~15\.0\.11$/);
  assert.ok(app.expo.plugins.some((entry)=>Array.isArray(entry)&&entry[0]==='expo-web-browser'));
  assert.equal(app.expo.scheme,'alantil');
  const filter=app.expo.android.intentFilters.find((entry)=>entry.action==='VIEW');
  assert.ok(filter);
  assert.ok(filter.category.includes('BROWSABLE'));
  assert.ok(filter.category.includes('DEFAULT'));
  assert.ok(filter.data.some((entry)=>entry.scheme==='alantil'&&entry.host==='auth'&&entry.pathPrefix==='/callback'));
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

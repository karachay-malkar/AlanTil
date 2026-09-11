import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const mobile=path.resolve(here,'..');
const read=(file)=>fs.readFileSync(path.join(mobile,file),'utf8');
const root=read('AppRoot.js');
const pathScreen=read('screens/path.js');
const pathWindow=fs.readFileSync(path.resolve(mobile,'../packages/alantil-ui/path-window.js'),'utf8');
const stationWindow=read('ui/path-station-window.js');
const authEntry=read('ui/auth-entry-actions.js');
const authChoice=read('screens/auth-choice.js');
const profileMain=read('screens/profile-main.js');
const profile=read('screens/profile.js');
const storage=read('platform/storage.js');
const auth=read('platform/auth.native.js');
const app=JSON.parse(read('app.json'));
const nativeSupabase=read('platform/supabase.native.js');

test('16.6.6 path story changes reset virtualization before new geometry is filtered',()=>{
  assert.match(pathWindow,/ready:false/);
  assert.match(pathWindow,/reset\(scope=''/);
  assert.match(pathWindow,/nextScope!==snapshot\.scope/);
  assert.match(pathWindow,/if\(!window\.ready\)return true/);
  assert.match(stationWindow,/!window\?\.ready\|\|stationInWindow/);
  assert.match(pathScreen,/createPathWindow\(defaultStory\)/);
  assert.match(pathScreen,/stationWindow\.reset\(activeStory\)/);
  assert.match(pathScreen,/restoreGenerationRef/);
  assert.match(pathScreen,/restoreInFlightRef/);
  assert.match(pathScreen,/stationWindow\.update\(targetOffset,viewport,targetStory\)/);
  assert.match(pathScreen,/stationWindow\.update\(offset,viewportHeightRef\.current,activeStory\)/);
  assert.doesNotMatch(pathScreen,/contentHeightRef\.current=1;viewportHeightRef\.current=1;offsetRef\.current=0/);
});

test('16.6.6 onboarding completion no longer suppresses the independent auth choice',()=>{
  const functionBody=storage.match(/export async function hasCompletedNativeAuthChoice\(\)\{([^}]*)\}/)?.[1]||'';
  assert.match(functionBody,/KEYS\.authChoice/);
  assert.doesNotMatch(functionBody,/hasCompletedNativeOnboarding|legacyOnboarding/);
  assert.match(root,/needsSetup=!session\?\.user&&!hasCompletedLearningSetup/);
  assert.match(root,/authChoiceRequired/);
  assert.match(root,/if\(setupRequired\).*OnboardingScreen/);
  assert.match(root,/if\(authChoiceRequired\).*AuthChoiceScreen/);
});

test('16.6.6 Google entry UI is reused on first run, guest profile and Account',()=>{
  assert.match(authEntry,/AUTH_PROVIDERS/);
  assert.match(authEntry,/signInWithGoogleNative/);
  assert.match(authChoice,/AuthEntryActions/);
  assert.match(profileMain,/AuthEntryActions settings=\{settings\} style=\{styles\.guestAction\}/);
  assert.doesNotMatch(profileMain,/role="profile\.guestAccount"/);
  assert.match(profile,/AuthEntryActions settings=\{settings\} allowGuest/);
  assert.doesNotMatch(profile,/AuthProviderButton label=\{msg\('account\.voyti_cherez_google'\)\}/);
});

test('16.6.6 native OAuth is constrained to the app callback and survives warm/cold callback delivery',()=>{
  assert.match(auth,/NATIVE_AUTH_REDIRECT_URL='alantil:\/\/auth\/callback'/);
  assert.match(auth,/redirect!==NATIVE_AUTH_REDIRECT_URL/);
  assert.doesNotMatch(nativeSupabase,/appendPkceFlowIdToRedirects/);
  assert.match(auth,/writePendingOAuth\(authUrl,data\.flowId\)/);
  assert.match(auth,/flowId=params\.flowId\|\|validation\.pending\?\.flowId\|\|''/);
  assert.match(auth,/OAUTH_PENDING_MAX_AGE_MS=15\*60\*1000/);
  assert.match(auth,/validatePendingCallback/);
  assert.match(auth,/OAUTH_FLOW_MISMATCH/);
  assert.match(auth,/Linking\.addEventListener\('url'/);
  assert.match(auth,/Linking\.getInitialURL\(\)/);
  assert.match(auth,/exchangeCodeForSession\(params\.code,options\)/);
  assert.match(auth,/accessToken.*refreshToken/s);
  assert.match(auth,/await persist\(session\)/);
  assert.match(auth,/await clearPendingOAuth\(\);await dismissAuthBrowser\(\)/);
  assert.match(auth,/result\?\.type==='cancel'\|\|result\?\.type==='dismiss'/);
  assert.match(auth,/await clearPendingOAuth\(\);lastHandledCallbackUrl=''/);
  assert.doesNotMatch(auth,/https?:\/\/alantil/);
  assert.equal(app.expo.scheme,'alantil');
  const view=app.expo.android.intentFilters.find(item=>item.action==='VIEW');
  assert.ok(view?.data?.some(item=>item.scheme==='alantil'&&item.host==='auth'&&item.pathPrefix==='/callback'));
});

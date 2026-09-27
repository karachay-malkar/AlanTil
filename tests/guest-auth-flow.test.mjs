import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("guest profile prompt is removed from first-entry runtime", async () => {
  const bootstrap = await read("src/app/bootstrap.js");
  const appStyles = await read("src/shared/styles/app.css");
  const index = await read("index.html");
  assert.doesNotMatch(bootstrap, /initGuestProfilePrompt|guest-profile-prompt/);
  assert.doesNotMatch(appStyles, /guest-profile-prompt/);
  assert.doesNotMatch(index, /guest-profile-prompt/);
  await assert.rejects(access(new URL("../src/shared/auth/guest-profile-prompt.js", import.meta.url)));
  await assert.rejects(access(new URL("../src/shared/styles/guest-profile-prompt.css", import.meta.url)));
});

test("email/password is the visible account entry and Google is hidden from the normal provider list", async () => {
  const providers = await read("src/config/auth-providers.js");
  const login = await read("src/features/account/login.js");
  assert.match(providers, /id: "google"[\s\S]*?enabled: false/);
  assert.match(login, /accountAuthEmail/);
  assert.match(login, /accountAuthPassword/);
  assert.match(login, /accountLegacyGoogle/);
  assert.doesNotMatch(login, /data-auth-provider/);
});

test("legacy Google remains available only as an explicit migration flow", async () => {
  const auth = await read("src/shared/auth/auth-service.js");
  assert.match(auth, /client\.auth\.signInWithOAuth\(/);
  assert.match(auth, /signInWithLegacyGoogle/);
  assert.match(auth, /flow: "legacy_google"/);
  assert.match(auth, /updateUser\(\{ password: normalizedPassword \}\)/);
});

test("email auth supports sign-in, sign-up and recovery", async () => {
  const auth = await read("src/shared/auth/auth-service.js");
  assert.match(auth, /signInWithPassword/);
  assert.match(auth, /client\.auth\.signUp/);
  assert.match(auth, /resetPasswordForEmail/);
  assert.match(auth, /getAuthRedirectUrl\("recovery"\)/);
});

test("auth and account modules bypass stale cache", async () => {
  const worker = await read("service-worker.js");
  assert.match(worker, /networkFirstStaticResponse/);
  assert.match(worker, /src\/shared\/auth/);
  assert.match(worker, /src\/features\/account/);
});

test("account screen warms the SDK without blocking the visible login form", async () => {
  const login = await read("src/features/account/login.js");
  const renderIndex = login.indexOf("export function renderLogin");
  const warmIndex = login.indexOf("void preloadSupabaseClient()", renderIndex);
  const markupIndex = login.indexOf("context.root.innerHTML", renderIndex);
  assert.ok(warmIndex > renderIndex);
  assert.ok(markupIndex > warmIndex);
});

test("Supabase SDK loading has a same-origin fallback", async () => {
  const client = await read("src/shared/auth/supabase-client.js");
  assert.match(client, /cdn\.jsdelivr\.net/);
  assert.match(client, /LOCAL_FALLBACK_MODULE_URL/);
  assert.match(client, /\/src\/vendor\/supabase-js\.js/);
  assert.match(client, /firstSuccessful/);
});

test("authentication has a bounded callback timeout and no automatic retry loop", async () => {
  const auth = await read("src/shared/auth/auth-service.js");
  assert.match(auth, /AUTH_REQUEST_TIMEOUT_MS = 15000/);
  assert.doesNotMatch(auth, /AUTH_RETRY_DELAYS_MS|async function retryAuth|const sleep/);
  const callbackStart = auth.indexOf("async function handleAuthCallback");
  const callbackEnd = auth.indexOf("function startAuthInitialization", callbackStart);
  assert.doesNotMatch(auth.slice(callbackStart, callbackEnd), /retryAuth/);
});

test("guest action remains available independently of authentication", async () => {
  const login = await read("src/features/account/login.js");
  assert.match(login, /accountContinueGuest/);
  assert.match(login, /onGuest/);
});

test("guest auth initialization avoids loading Supabase without a saved session", async () => {
  const auth = await read("src/shared/auth/auth-service.js");
  assert.match(auth, /!callbackPresent && !hasPersistedAuthSession\(\)/);
  const guardIndex = auth.indexOf("!callbackPresent && !hasPersistedAuthSession()");
  const clientIndex = auth.indexOf("getSupabaseClient()", guardIndex);
  assert.ok(guardIndex >= 0 && clientIndex > guardIndex);
});

test("cold start has a local dictionary and public REST uses only apikey", async () => {
  const repository = await read("src/shared/data/word-repository.js");
  const starter = await read("src/data/starter-dictionary.js");
  assert.match(repository, /readStarterDictionary/);
  assert.match(repository, /scheduleBackgroundRefresh/);
  assert.match(repository, /apikey: supabasePublishableKey/);
  assert.doesNotMatch(repository, /Authorization:\s*`Bearer \$\{supabasePublishableKey\}`/);
  assert.match(starter, /STARTER_DICTIONARY_VERSION/);
  assert.match(starter, /"0001"/);
  assert.match(starter, /"1199"/);
  assert.match(starter, /"1760"/);
});

test("service worker caches only the guest shell eagerly", async () => {
  const worker = await read("service-worker.js");
  assert.match(worker, /navigationResponse/);
  assert.match(worker, /staticResponse/);
  const coreAssets = worker.match(/const CORE_ASSETS = \[([\s\S]*?)\];/)?.[1] || "";
  assert.match(coreAssets, /starter-dictionary/);
  assert.doesNotMatch(coreAssets, /supabase-js|payload-[1-4]/);
});

test("successful account sign-in and non-recovery callbacks return to Roots", async () => {
  const auth = await read("src/shared/auth/auth-service.js");
  const account = await read("src/features/account/index.js");
  assert.match(auth, /AUTH_DESTINATION_PATH = "\/path\/roots"/);
  assert.match(account, /!previousUserId && nextUserId/);
  assert.match(account, /context[.]router[.]replace\(\s*"path[.]home",[\s\S]*storyType: "roots"[\s\S]*reason: "auth_success"/);
});

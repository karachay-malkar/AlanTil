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

test("Google is rendered as an immediate local provider button", async () => {
  const providers = await read("src/config/auth-providers.js");
  const login = await read("src/features/account/login.js");
  assert.match(providers, /id: "google"[\s\S]*?enabled: true[\s\S]*?identityButton: false/);
  assert.match(login, /renderAuthProviderButton/);
  assert.match(login, /data-auth-provider/);
  assert.doesNotMatch(login, /data-google-fallback|data-google-official|onGoogleMount/);
});

test("Google redirect is built locally and does not wait for the Supabase SDK", async () => {
  const auth = await read("src/shared/auth/auth-service.js");
  const start = auth.indexOf("export async function signInWithProvider");
  const end = auth.indexOf("export async function signOut", start);
  const providerFlow = auth.slice(start, end);
  assert.match(auth, /auth\/v1\/authorize/);
  assert.match(auth, /code_challenge/);
  assert.match(auth, /code_challenge_method/);
  assert.match(auth, /PKCE_VERIFIER_KEY/);
  assert.match(providerFlow, /prepareSignInWithProvider/);
  assert.match(providerFlow, /window\.location\.href/);
  assert.doesNotMatch(providerFlow, /getSupabaseClient|signInWithOAuth|signInWithIdToken|retryAuth/);
});

test("Google OAuth is prepared before the tap and uses synchronous navigation", async () => {
  const login = await read("src/features/account/login.js");
  const auth = await read("src/shared/auth/auth-service.js");
  assert.match(login, /prepareSignInWithProvider/);
  assert.match(login, /button\.dataset\.authHref/);
  assert.match(login, /window\.location\.href = preparedUrl/);
  assert.match(login, /PROVIDER_FALLBACK_RESET_MS = 5000/);
  assert.match(auth, /preparedOAuthRedirects/);
  assert.match(auth, /export function prepareSignInWithProvider/);
});

test("auth and account modules bypass stale cache", async () => {
  const worker = await read("service-worker.js");
  assert.match(worker, /networkFirstStaticResponse/);
  assert.match(worker, /src\/shared\/auth/);
  assert.match(worker, /src\/features\/account/);
});

test("account screen warms the SDK without blocking the visible login button", async () => {
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

test("guest action remains available independently of Google", async () => {
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


test("successful account sign-in returns directly to Path", async () => {
  const auth = await read("src/shared/auth/auth-service.js");
  const account = await read("src/features/account/index.js");
  assert.match(auth, /AUTH_DESTINATION_PATH = "\/path\/understanding"/);
  assert.match(account, /!previousUserId && nextUserId/);
  assert.match(account, /context[.]router[.]replace\(\s*"path[.]home",[\s\S]*storyType: "understanding"[\s\S]*reason: "auth_success"/);
});

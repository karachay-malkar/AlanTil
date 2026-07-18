import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("guest prompt contains the approved Russian copy", async () => {
  const messages = await read("src/shared/i18n/messages-13-10.js");
  assert.match(messages, /Создайте профиль через Google или Apple/);
  assert.match(messages, /Отдельная регистрация и пароль не нужны — просто выберите удобный способ входа\./);
  assert.match(messages, /Профиль позволит сохранять прогресс и пользоваться расширенными функциями приложения\./);
});

test("Google is rendered as an immediate local provider button", async () => {
  const providers = await read("src/config/auth-providers.js");
  const login = await read("src/features/account/login.js");
  assert.match(providers, /id: "google"[\s\S]*?enabled: true[\s\S]*?identityButton: false/);
  assert.match(login, /renderAuthProviderButton/);
  assert.match(login, /data-auth-provider/);
  assert.doesNotMatch(login, /data-google-fallback|data-google-official|onGoogleMount/);
});

test("Google uses one-shot Supabase redirect OAuth", async () => {
  const auth = await read("src/shared/auth/auth-service.js");
  const start = auth.indexOf("export async function signInWithProvider");
  const end = auth.indexOf("export async function signOut", start);
  const providerFlow = auth.slice(start, end);
  assert.match(providerFlow, /OAUTH_PROVIDERS\.has/);
  assert.match(providerFlow, /signInWithOAuth/);
  assert.match(providerFlow, /provider: normalized/);
  assert.match(providerFlow, /redirectTo: getAuthRedirectUrl\(\)/);
  assert.match(providerFlow, /prompt: "select_account"/);
  assert.doesNotMatch(providerFlow, /retryAuth|signInWithIdToken/);
});

test("authentication has a bounded timeout and no automatic retry loop", async () => {
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

test("starter dictionary contains valid current rows for every story", async () => {
  const { STARTER_DICTIONARY } = await import("../src/data/starter-dictionary.js?v=13.10.4-test");
  assert.equal(STARTER_DICTIONARY.length, 60);
  assert.deepEqual(new Set(STARTER_DICTIONARY.map((row) => String(row.story_id))), new Set(["1", "2", "3"]));
  assert.ok(STARTER_DICTIONARY.every((row) => row.word_id && row.word_alan_cyrillic && row.translation_ru));
});

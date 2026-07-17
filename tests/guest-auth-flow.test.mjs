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

test("Google option is visible before the official script is ready", async () => {
  const login = await read("src/features/account/login.js");
  const identity = await read("src/shared/auth/google-identity.js");
  assert.match(login, /data-google-fallback/);
  assert.match(login, /authProviderIcon/);
  assert.match(identity, /accounts\.id\.renderButton/);
  assert.match(identity, /activeRenderers/);
  assert.doesNotMatch(identity, /googleClientIdEndpoint/);
});

test("Google client ID is local public configuration", async () => {
  const config = await read("src/config/auth.js");
  assert.match(config, /\.apps\.googleusercontent\.com/);
  assert.match(config, /accounts\.google\.com\/gsi\/client/);
});

test("Google token exchange retries and does not use a seven-second cutoff", async () => {
  const auth = await read("src/shared/auth/auth-service.js");
  assert.match(auth, /AUTH_REQUEST_TIMEOUT_MS = 60000/);
  assert.match(auth, /retryAuth/);
  assert.match(auth, /signInWithIdToken/);
  assert.doesNotMatch(auth, /AUTH_REQUEST_TIMEOUT_MS = 7000/);
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
  const clientIndex = auth.indexOf("const client = await getSupabaseClient()", guardIndex);
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
  const { STARTER_DICTIONARY } = await import("../src/data/starter-dictionary.js?v=13.10.3-test");
  assert.equal(STARTER_DICTIONARY.length, 60);
  assert.deepEqual(new Set(STARTER_DICTIONARY.map((row) => String(row.story_id))), new Set(["1", "2", "3"]));
  assert.ok(STARTER_DICTIONARY.every((row) => row.word_id && row.word_alan_cyrillic && row.translation_ru));
});

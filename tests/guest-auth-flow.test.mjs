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

test("Email sign-in is fully absent from the account flow", async () => {
  const auth = await read("src/shared/auth/auth-service.js");
  const account = await read("src/features/account/index.js");
  const login = await read("src/features/account/login.js");
  assert.doesNotMatch(auth, /signInWithEmail|signInWithOtp/);
  assert.doesNotMatch(account, /signInWithEmail|emailExpanded|onEmail/);
  assert.doesNotMatch(login, /accountEmail|voyti_po_email/);
});

test("Google sign-in uses Google Identity Services without an OAuth browser redirect", async () => {
  const auth = await read("src/shared/auth/auth-service.js");
  const identity = await read("src/shared/auth/google-identity.js");
  assert.match(identity, /accounts\.id\.renderButton/);
  assert.match(identity, /accounts\.google\.com\/gsi\/client/);
  assert.match(auth, /signInWithIdToken/);
  assert.match(auth, /provider: "google"/);
  assert.doesNotMatch(auth, /REDIRECT_OAUTH_PROVIDERS = new Set\(\["google"/);
});

test("guest action returns directly to the path", async () => {
  const account = await read("src/features/account/index.js");
  assert.match(account, /context\.router\.replace\(\s*"path\.home"/);
  assert.doesNotMatch(account, /router\.navigate\("home"\)/);
});

test("OAuth callback has a dedicated URL and returns to the account screen", async () => {
  const config = await read("src/config/supabase.js");
  const auth = await read("src/shared/auth/auth-service.js");
  assert.match(config, /new URL\("\/auth\/callback"/);
  assert.match(auth, /AUTH_DESTINATION_PATH = "\/profile\/account"/);
});

test("dictionary requests remain bounded and cache-first", async () => {
  const repository = await read("src/shared/data/word-repository.js");
  assert.match(repository, /AbortController/);
  assert.match(repository, /REQUEST_TIMEOUT_MS = 7000/);
  assert.match(repository, /const cached = readDictionaryCache\(\)/);
});

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

test("Email sign-in is absent from the account interface", async () => {
  const login = await read("src/features/account/login.js");
  assert.doesNotMatch(login, /accountEmail|accountEmailForm|voyti_po_email|signInWithOtp/);
  assert.match(login, /getEnabledAuthProviders/);
});

test("guest storage cannot be read or removed while an account is active", async () => {
  const storage = await read("src/shared/progress/storage-scope.js");
  assert.match(storage, /isInactiveGuestScope/);
  assert.match(storage, /if \(isInactiveGuestScope\(scope\)\) return fallback/);
  assert.match(storage, /if \(isInactiveGuestScope\(scope\)\) return false/);
});

test("application starts local progress before background authentication", async () => {
  const bootstrap = await read("src/app/bootstrap.js");
  const localIndex = bootstrap.indexOf("await initializeProgressSystem()");
  const authIndex = bootstrap.indexOf("void initializeAuth()");
  assert.ok(localIndex >= 0 && authIndex > localIndex);
});

test("dictionary requests are bounded and do not require the Supabase SDK", async () => {
  const repository = await read("src/shared/data/word-repository.js");
  assert.match(repository, /AbortController/);
  assert.match(repository, /REQUEST_TIMEOUT_MS = 7000/);
  assert.doesNotMatch(repository, /getSupabaseClient/);
});

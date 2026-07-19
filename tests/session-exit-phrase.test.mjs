import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const memory = new Map();
globalThis.localStorage = {
  getItem(key) { return memory.has(key) ? memory.get(key) : null; },
  setItem(key, value) { memory.set(key, String(value)); },
  removeItem(key) { memory.delete(key); },
};
globalThis.window = { dispatchEvent() {}, addEventListener() {} };
globalThis.CustomEvent = class CustomEvent {};

const display = await import(new URL("../src/shared/domain/alan-display.js", import.meta.url));

test("session exit phrase follows only Alan script", () => {
  assert.equal(display.getDisplayedSessionExitPhrase({ alan_script_code: "cyrillic", interface_language_code: "en" }), "Не болса да болсун!");
  assert.equal(display.getDisplayedSessionExitPhrase({ alan_script_code: "turkic", interface_language_code: "ru" }), "Ne bolsa da bolsun!");
});

test("modal uses the script-aware phrase helper", async () => {
  const modal = await readFile(new URL("../src/shared/ui/modal.js", import.meta.url), "utf8");
  assert.match(modal, /confirmText = getDisplayedSessionExitPhrase\(\)/);
  assert.doesNotMatch(modal, /confirmText = msg\("common\.ne_bolsa_da_bolsun"\)/);
});

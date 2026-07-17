import test from "node:test";
import assert from "node:assert/strict";

const storage = new Map();
globalThis.localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); },
};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
};
globalThis.window = { dispatchEvent() {} };

const settingsStore = await import("../src/shared/settings/user-settings-store.js?v=13.8.1");
const progressQueue = await import("../src/shared/progress/progress-queue.js?v=13.8.1");

test("all Cyrillic variants survive storage reload and enter the sync payload", () => {
  for (const dialect of ["karachay", "balkar", "canonical"]) {
    const saved = settingsStore.setUserSettings({
      alan_script_code: "cyrillic",
      alan_dialect_code: dialect,
    }, { forceQueue: true });
    assert.equal(saved.alan_dialect_code, dialect);
    assert.equal(settingsStore.reloadUserSettings().alan_dialect_code, dialect);

    const entry = progressQueue.readProgressQueue().find((item) => item.id === "user_settings:current");
    assert.ok(entry);
    assert.equal(entry.payload.alan_script_code, "cyrillic");
    assert.equal(entry.payload.alan_dialect_code, dialect);
  }
});

import assert from "node:assert/strict";
import test from "node:test";

const memory = new Map();
globalThis.localStorage = {
  getItem(key) { return memory.has(key) ? memory.get(key) : null; },
  setItem(key, value) { memory.set(key, String(value)); },
  removeItem(key) { memory.delete(key); },
};
globalThis.window = { dispatchEvent() {} };
globalThis.CustomEvent = class CustomEvent {
  constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
};

const queue = await import(new URL("../src/shared/progress/progress-queue.js", import.meta.url));
const scope = "user:test";
const guestSettings = {
  id: "user_settings:current",
  type: "user_settings",
  payload: {
    interface_language_code: "tr",
    translation_language_code: "tr",
    alan_script_code: "turkic",
    alan_dialect_code: "canonical",
    learning_setup_completed_at: "2026-07-18T10:00:00.000Z",
  },
};

test("guest setup replaces only a blank new-account settings entry", () => {
  queue.writeProgressQueue([{
    id: "user_settings:current",
    type: "user_settings",
    payload: { learning_setup_completed_at: null },
  }], scope);
  queue.mergeProgressQueues([guestSettings], scope);
  assert.equal(queue.readProgressQueue(scope)[0].payload.interface_language_code, "tr");
});

test("existing cloud or pending account settings are not overwritten", () => {
  queue.writeProgressQueue([{
    id: "user_settings:current",
    type: "user_settings",
    payload: {
      interface_language_code: "en",
      learning_setup_completed_at: "2026-07-01T10:00:00.000Z",
    },
  }], scope);
  queue.mergeProgressQueues([guestSettings], scope);
  assert.equal(queue.readProgressQueue(scope)[0].payload.interface_language_code, "en");
});

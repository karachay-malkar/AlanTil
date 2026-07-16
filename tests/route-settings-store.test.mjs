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

const routeSettings = await import("../src/shared/progress/route-settings-store.js");
const progressQueue = await import("../src/shared/progress/progress-queue.js");

test("scroll positions remain local and never enter the Supabase payload", () => {
  routeSettings.updateRouteSettings({ route_scroll_v2_1_40: 777 }, { queue: false });
  routeSettings.updateRouteSettings({ active_story: "2" });

  const [entry] = progressQueue.readProgressQueue();
  assert.equal(entry.type, "route_settings");
  assert.equal(entry.payload.active_story, "2");
  assert.equal(entry.payload.route_scroll_v2_1_40, undefined);
  assert.deepEqual(Object.keys(entry.payload).sort(), [
    "active_story",
    "selected_background_route",
    "selected_dictionary_id",
    "updated_at",
  ]);

  routeSettings.replaceRouteSettings({ active_story: "3" });
  const merged = routeSettings.getRouteSettings();
  assert.equal(merged.active_story, "3");
  assert.equal(merged.route_scroll_v2_1_40, 777);
});

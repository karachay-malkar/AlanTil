import { PATH_CONFIG } from "../../config/path.js?v=16.8.0.2";
import { enqueueProgress } from "./progress-queue.js?v=16.8.0.2";
import { readScopedJson, writeScopedJson } from "./storage-scope.js?v=16.8.0.2";

export const ROUTE_SETTINGS_KEY = "alantil_route_settings_v13_1";
const LEGACY_STORY_ID = "oblivion";
const CURRENT_STORY_ID = PATH_CONFIG.defaultStoryType;
const LEGACY_SCROLL_KEY = `route_scroll_v3_${LEGACY_STORY_ID}`;
const CURRENT_SCROLL_KEY = `route_scroll_v3_${CURRENT_STORY_ID}`;

const DEFAULTS = Object.freeze({
  selected_dictionary_id: PATH_CONFIG.dictionaryId,
  active_story: PATH_CONFIG.defaultStoryType,
  selected_background_route: PATH_CONFIG.routeBackground,
  updated_at: null,
});

function migrateLegacyStorySettings(settings = {}) {
  const next = { ...(settings || {}) };
  let changed = false;
  if (next.active_story === LEGACY_STORY_ID) { next.active_story = CURRENT_STORY_ID; changed = true; }
  if (Object.prototype.hasOwnProperty.call(next, LEGACY_SCROLL_KEY)) {
    if (!Object.prototype.hasOwnProperty.call(next, CURRENT_SCROLL_KEY)) next[CURRENT_SCROLL_KEY] = next[LEGACY_SCROLL_KEY];
    delete next[LEGACY_SCROLL_KEY];
    changed = true;
  }
  return { next, changed };
}

function cloudSettingsPayload(settings = {}) {
  return {
    selected_dictionary_id: settings.selected_dictionary_id,
    active_story: settings.active_story,
    selected_background_route: settings.selected_background_route,
    updated_at: settings.updated_at,
  };
}

export function getRouteSettings() {
  const stored = readScopedJson(ROUTE_SETTINGS_KEY, {}) || {};
  const migrated = migrateLegacyStorySettings(stored);
  if (migrated.changed) writeScopedJson(ROUTE_SETTINGS_KEY, migrated.next);
  return { ...DEFAULTS, ...migrated.next };
}

export function updateRouteSettings(updates = {}, { queue = true } = {}) {
  const normalizedUpdates = migrateLegacyStorySettings(updates).next;
  const next = { ...getRouteSettings(), ...normalizedUpdates, updated_at: new Date().toISOString() };
  writeScopedJson(ROUTE_SETTINGS_KEY, next);
  if (queue) enqueueProgress("route_settings", cloudSettingsPayload(next), { id: "route_settings", replace: true });
  return next;
}

export function replaceRouteSettings(row) {
  const local = readScopedJson(ROUTE_SETTINGS_KEY, {}) || {};
  const migrated = migrateLegacyStorySettings({ ...DEFAULTS, ...local, ...(row || {}) });
  writeScopedJson(ROUTE_SETTINGS_KEY, migrated.next);
  return migrated.next;
}

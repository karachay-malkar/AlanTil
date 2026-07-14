import { PATH_CONFIG } from "../../config/path.js";
import { enqueueProgress } from "./progress-queue.js";
import { readScopedJson, writeScopedJson } from "./storage-scope.js";

export const ROUTE_SETTINGS_KEY = "alantil_route_settings_v13_1";
const DEFAULTS = Object.freeze({
  selected_dictionary_id: PATH_CONFIG.dictionaryId,
  active_story: "ascent",
  selected_background_route: PATH_CONFIG.routeBackground,
  updated_at: null,
});

export function getRouteSettings() {
  return { ...DEFAULTS, ...(readScopedJson(ROUTE_SETTINGS_KEY, {}) || {}) };
}

export function updateRouteSettings(updates = {}, { queue = true } = {}) {
  const next = { ...getRouteSettings(), ...updates, updated_at: new Date().toISOString() };
  writeScopedJson(ROUTE_SETTINGS_KEY, next);
  if (queue) enqueueProgress("route_settings", next, { id: "route_settings", replace: true });
  return next;
}

export function replaceRouteSettings(row) {
  const next = { ...DEFAULTS, ...(row || {}) };
  writeScopedJson(ROUTE_SETTINGS_KEY, next);
  return next;
}

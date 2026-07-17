import { PATH_CONFIG } from "../../config/path.js?v=13.8";
import { enqueueProgress } from "./progress-queue.js?v=13.8";
import { readScopedJson, writeScopedJson } from "./storage-scope.js?v=13.8";

export const ROUTE_SETTINGS_KEY = "alantil_route_settings_v13_1";
const DEFAULTS = Object.freeze({
  selected_dictionary_id: PATH_CONFIG.dictionaryId,
  active_story: "ascent",
  selected_background_route: PATH_CONFIG.routeBackground,
  updated_at: null,
});

function cloudSettingsPayload(settings = {}) {
  return {
    selected_dictionary_id: settings.selected_dictionary_id,
    active_story: settings.active_story,
    selected_background_route: settings.selected_background_route,
    updated_at: settings.updated_at,
  };
}

export function getRouteSettings() {
  return { ...DEFAULTS, ...(readScopedJson(ROUTE_SETTINGS_KEY, {}) || {}) };
}

export function updateRouteSettings(updates = {}, { queue = true } = {}) {
  const next = { ...getRouteSettings(), ...updates, updated_at: new Date().toISOString() };
  writeScopedJson(ROUTE_SETTINGS_KEY, next);
  if (queue) enqueueProgress("route_settings", cloudSettingsPayload(next), { id: "route_settings", replace: true });
  return next;
}

export function replaceRouteSettings(row) {
  const local = readScopedJson(ROUTE_SETTINGS_KEY, {}) || {};
  const next = { ...DEFAULTS, ...local, ...(row || {}) };
  writeScopedJson(ROUTE_SETTINGS_KEY, next);
  return next;
}

import { enqueueProgress } from "../progress/progress-queue.js?v=13.9.0";
import {
  readScopedJson,
  subscribeStorageScope,
  writeScopedJson,
} from "../progress/storage-scope.js?v=13.9.0";

export const USER_SETTINGS_KEY = "alantil_user_settings_v1";
export const DEFAULT_USER_SETTINGS = Object.freeze({
  interface_language_code: "ru",
  translation_language_code: "ru",
  alan_script_code: "cyrillic",
  alan_dialect_code: "canonical",
  station_size: 40,
});

const listeners = new Set();
let state = { ...DEFAULT_USER_SETTINGS };

function normalizeLanguageCode(value, fallback = "ru") {
  const normalized = String(value || "").trim().toLowerCase();
  return /^[a-z]{2,8}(?:-[a-z0-9]{2,8})?$/.test(normalized) ? normalized : fallback;
}

function normalizeInterfaceLanguageCode(value) {
  const source = normalizeLanguageCode(value, DEFAULT_USER_SETTINGS.interface_language_code).split("-")[0];
  const normalized = source === "tu" ? "tr" : source;
  return ["ru", "en", "tr"].includes(normalized) ? normalized : DEFAULT_USER_SETTINGS.interface_language_code;
}

function normalizeStationSize(value) {
  return Number(value) === 20 ? 20 : 40;
}

function normalizeAlanScriptCode(value) {
  return value === "turkic" ? "turkic" : "cyrillic";
}

function normalizeAlanDialectCode(value) {
  return ["canonical", "karachay", "balkar"].includes(value) ? value : "canonical";
}

function normalizeSettings(value = {}) {
  return {
    interface_language_code: normalizeInterfaceLanguageCode(value.interface_language_code),
    translation_language_code: normalizeLanguageCode(value.translation_language_code, DEFAULT_USER_SETTINGS.translation_language_code),
    alan_script_code: normalizeAlanScriptCode(value.alan_script_code),
    alan_dialect_code: normalizeAlanDialectCode(value.alan_dialect_code),
    station_size: normalizeStationSize(value.station_size),
  };
}

function notify() {
  const snapshot = getUserSettings();
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      console.error("User settings subscriber failed", error);
    }
  });
}

export function reloadUserSettings() {
  state = normalizeSettings(readScopedJson(USER_SETTINGS_KEY, DEFAULT_USER_SETTINGS));
  notify();
  return getUserSettings();
}

export function getUserSettings() {
  return { ...state };
}

export function getTranslationLanguageCode() {
  return state.translation_language_code;
}

export function getStationSize() {
  return normalizeStationSize(state.station_size);
}

export function setUserSettings(updates = {}, {
  queue = true,
  forceQueue = false,
  requireStorage = false,
} = {}) {
  const previous = state;
  const next = normalizeSettings({ ...state, ...updates });
  const changed = next.interface_language_code !== state.interface_language_code
    || next.translation_language_code !== state.translation_language_code
    || next.alan_script_code !== state.alan_script_code
    || next.alan_dialect_code !== state.alan_dialect_code
    || next.station_size !== state.station_size;
  state = next;
  const stored = writeScopedJson(USER_SETTINGS_KEY, state);
  if (!stored && requireStorage) {
    state = previous;
    throw new Error("User settings could not be written to local storage.");
  }
  if ((changed || forceQueue) && queue) {
    enqueueProgress("user_settings", {
      ...state,
      updated_at: new Date().toISOString(),
    }, { id: "user_settings:current" });
  }
  if (changed) notify();
  return getUserSettings();
}

export function replaceUserSettings(settings = {}) {
  state = normalizeSettings(settings);
  writeScopedJson(USER_SETTINGS_KEY, state);
  notify();
  return getUserSettings();
}

export function subscribeUserSettings(listener) {
  listeners.add(listener);
  listener(getUserSettings());
  return () => listeners.delete(listener);
}

subscribeStorageScope(() => reloadUserSettings());
reloadUserSettings();

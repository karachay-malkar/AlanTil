import { enqueueProgress } from "../progress/progress-queue.js";
import {
  readScopedJson,
  subscribeStorageScope,
  writeScopedJson,
} from "../progress/storage-scope.js";

export const USER_SETTINGS_KEY = "alantil_user_settings_v1";
export const DEFAULT_USER_SETTINGS = Object.freeze({
  interface_language_code: "ru",
  translation_language_code: "ru",
});

const listeners = new Set();
let state = { ...DEFAULT_USER_SETTINGS };

function normalizeLanguageCode(value, fallback = "ru") {
  const normalized = String(value || "").trim().toLowerCase();
  return /^[a-z]{2,8}(?:-[a-z0-9]{2,8})?$/.test(normalized) ? normalized : fallback;
}

function normalizeSettings(value = {}) {
  return {
    interface_language_code: normalizeLanguageCode(value.interface_language_code, DEFAULT_USER_SETTINGS.interface_language_code),
    translation_language_code: normalizeLanguageCode(value.translation_language_code, DEFAULT_USER_SETTINGS.translation_language_code),
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

export function setUserSettings(updates = {}, { queue = true } = {}) {
  const next = normalizeSettings({ ...state, ...updates });
  const changed = next.interface_language_code !== state.interface_language_code
    || next.translation_language_code !== state.translation_language_code;
  state = next;
  writeScopedJson(USER_SETTINGS_KEY, state);
  if (changed && queue) {
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

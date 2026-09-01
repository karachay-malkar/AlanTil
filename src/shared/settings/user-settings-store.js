import { enqueueProgress } from "../progress/progress-queue.js?v=13.10.12";
import {
  hasScopedValue,
  readScopedJson,
  subscribeStorageScope,
  writeScopedJson,
} from "../progress/storage-scope.js?v=13.10.12";
import {
  DEFAULT_USER_SETTINGS,
  applyUserSettingsUpdate,
  completeLearningSetupSettings,
  hasCompletedLearningSetup as hasCompletedLearningSetupCore,
  migrateStoredUserSettings,
  normalizeTextSizeCode,
  normalizeUserSettings,
  replaceUserSettingsValue,
  userSettingsChanged,
} from "../../../packages/alantil-core/settings.js";

export const USER_SETTINGS_KEY = "alantil_user_settings_v1";
export { DEFAULT_USER_SETTINGS };

const listeners = new Set();
let state = { ...DEFAULT_USER_SETTINGS };

function applyTextSizeCode(value) {
  const normalized = normalizeTextSizeCode(value);
  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.dataset.textSize = normalized;
  }
  return normalized;
}

function storedSettings(fallback = DEFAULT_USER_SETTINGS) {
  const hasStoredSettings = hasScopedValue(USER_SETTINGS_KEY);
  const stored = readScopedJson(USER_SETTINGS_KEY, fallback);
  return migrateStoredUserSettings(stored, hasStoredSettings);
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

export function reloadUserSettings({ preserveLanguageIfMissing = false } = {}) {
  const fallback = preserveLanguageIfMissing
    ? {
        ...DEFAULT_USER_SETTINGS,
        interface_language_code: state.interface_language_code,
        translation_language_code: state.translation_language_code,
        alan_script_code: state.alan_script_code,
        alan_dialect_code: state.alan_dialect_code,
        text_size_code: state.text_size_code,
      }
    : DEFAULT_USER_SETTINGS;
  state = normalizeUserSettings(storedSettings(fallback));
  applyTextSizeCode(state.text_size_code);
  writeScopedJson(USER_SETTINGS_KEY, state);
  notify();
  return getUserSettings();
}

export function getUserSettings() {
  return { ...state };
}

export function getTranslationLanguageCode() {
  return state.translation_language_code;
}

export function hasCompletedLearningSetup(settings = state) {
  return hasCompletedLearningSetupCore(settings);
}

export function setUserSettings(updates = {}, {
  queue = true,
  forceQueue = false,
  requireStorage = false,
} = {}) {
  const previous = state;
  const next = applyUserSettingsUpdate(state, updates);
  const changed = userSettingsChanged(state, next);
  state = next;
  applyTextSizeCode(state.text_size_code);
  const stored = writeScopedJson(USER_SETTINGS_KEY, state);
  if (!stored && requireStorage) {
    state = previous;
    applyTextSizeCode(state.text_size_code);
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

export function completeLearningSetup(updates = {}) {
  const next = completeLearningSetupSettings(state, updates);
  return setUserSettings(next, { requireStorage: true });
}

export function replaceUserSettings(settings = {}) {
  state = replaceUserSettingsValue(state, settings);
  applyTextSizeCode(state.text_size_code);
  writeScopedJson(USER_SETTINGS_KEY, state);
  notify();
  return getUserSettings();
}

export function subscribeUserSettings(listener) {
  listeners.add(listener);
  listener(getUserSettings());
  return () => listeners.delete(listener);
}

subscribeStorageScope(() => reloadUserSettings({ preserveLanguageIfMissing: true }));
reloadUserSettings();

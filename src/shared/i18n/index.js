import {
  getUserSettings,
  subscribeUserSettings,
} from "../settings/user-settings-store.js?v=13.15.12";
import { INTERFACE_MESSAGES } from "./messages.js?v=13.9.0";
import { RELEASE_MESSAGES_13_10 } from "./messages-13-10.js?v=13.10.0";
import { RELEASE_MESSAGES_13_15_9 } from "./messages-13-15-9.js?v=13.15.9";
import { RELEASE_MESSAGES_13_15_10 } from "./messages-13-15-10.js?v=13.15.10.12";
import { RELEASE_MESSAGES_13_15_12 } from "./messages-13-15-12.js?v=13.15.12";
import {
  SUPPORTED_INTERFACE_LANGUAGES,
  hasCompleteTranslations as coreHasCompleteTranslations,
  interfaceLocale,
  messageForLanguage as coreMessageForLanguage,
  normalizeInterfaceLanguage,
} from "../../../packages/alantil-core/i18n.js";

export { SUPPORTED_INTERFACE_LANGUAGES };

const ALL_INTERFACE_MESSAGES = Object.freeze({
  ...INTERFACE_MESSAGES,
  ...RELEASE_MESSAGES_13_10,
  ...RELEASE_MESSAGES_13_15_9,
  ...RELEASE_MESSAGES_13_15_10,
  ...RELEASE_MESSAGES_13_15_12,
});
const I18N_STATE_KEY = Symbol.for("alantil.i18n.state.v1");
const LANGUAGE_MIRROR_KEY = "alantil_interface_language_v1";

function createSharedState() {
  return {
    currentLanguage: "ru",
    missingKeys: new Set(),
    listeners: new Set(),
    unsubscribeSettings: null,
  };
}

const sharedState = globalThis[I18N_STATE_KEY] || createSharedState();
globalThis[I18N_STATE_KEY] = sharedState;

function translated(language, key, params = {}) {
  const result = coreMessageForLanguage(ALL_INTERFACE_MESSAGES, language, key, params);
  if (result.missing) {
    const warningKey = `${result.locale}:${key}`;
    if (!sharedState.missingKeys.has(warningKey)) {
      sharedState.missingKeys.add(warningKey);
      console.warn(`Missing ${result.locale} interface message: ${key}`);
    }
  }
  return result.value;
}

function persistLanguageMirror(language) {
  try {
    localStorage.setItem(LANGUAGE_MIRROR_KEY, language);
  } catch {
    // Restricted storage must not prevent language changes.
  }
}

export function getInterfaceLanguage() {
  return sharedState.currentLanguage;
}

export function getInterfaceLocale() {
  return interfaceLocale(sharedState.currentLanguage);
}

export function messageForLanguage(language, key, params = {}) {
  return translated(language, key, params);
}

export function msg(key, params = {}) {
  return translated(sharedState.currentLanguage, key, params);
}

export function applyStaticTranslations(root = document) {
  root.querySelectorAll?.("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (key) element.textContent = msg(key);
  });
  root.querySelectorAll?.("[data-i18n-aria-label]").forEach((element) => {
    const key = element.dataset.i18nAriaLabel;
    if (key) element.setAttribute("aria-label", msg(key));
  });
  root.querySelectorAll?.("[data-i18n-title]").forEach((element) => {
    const key = element.dataset.i18nTitle;
    if (key) element.setAttribute("title", msg(key));
  });
}

export function setInterfaceLanguage(language, { notify = true } = {}) {
  const next = normalizeInterfaceLanguage(language);
  const changed = next !== sharedState.currentLanguage;
  sharedState.currentLanguage = next;
  document.documentElement.lang = next;
  document.documentElement.dataset.i18nReady = "true";
  persistLanguageMirror(next);
  applyStaticTranslations(document);
  if (changed && notify) {
    const event = new CustomEvent("alantil:languagechange", { detail: { language: next } });
    window.dispatchEvent(event);
    sharedState.listeners.forEach((listener) => listener(next));
  }
  return next;
}

export function subscribeInterfaceLanguage(listener) {
  sharedState.listeners.add(listener);
  listener(sharedState.currentLanguage);
  return () => sharedState.listeners.delete(listener);
}

export function initializeI18n() {
  setInterfaceLanguage(getUserSettings().interface_language_code, { notify: false });
  if (!sharedState.unsubscribeSettings) {
    sharedState.unsubscribeSettings = subscribeUserSettings((settings) => {
      setInterfaceLanguage(settings.interface_language_code);
    });
  }
  return sharedState.currentLanguage;
}

export function hasCompleteTranslations(language) {
  return coreHasCompleteTranslations(ALL_INTERFACE_MESSAGES, language);
}

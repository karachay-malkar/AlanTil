import {
  getUserSettings,
  subscribeUserSettings,
} from "../settings/user-settings-store.js?v=13.9.0";
import { INTERFACE_MESSAGES } from "./messages.js?v=13.9.0";

export const SUPPORTED_INTERFACE_LANGUAGES = Object.freeze(["ru", "en", "tr"]);

const missingKeys = new Set();
const listeners = new Set();
let currentLanguage = "ru";
let unsubscribeSettings = null;

function normalizeLanguage(value) {
  const source = String(value || "").trim().toLowerCase().split("-")[0];
  const normalized = source === "tu" ? "tr" : source;
  return SUPPORTED_INTERFACE_LANGUAGES.includes(normalized) ? normalized : "ru";
}

function interpolate(template, params = {}) {
  return String(template || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (placeholder, name) => (
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name] ?? "") : placeholder
  ));
}

function sourceMessage(key) {
  const source = INTERFACE_MESSAGES[key]?.ru;
  if (source) return source;
  if (!missingKeys.has(key)) {
    missingKeys.add(key);
    console.warn(`Missing interface message: ${key}`);
  }
  return key;
}

export function getInterfaceLanguage() {
  return currentLanguage;
}

export function getInterfaceLocale() {
  return { ru: "ru-RU", en: "en-GB", tr: "tr-TR" }[currentLanguage] || "ru-RU";
}

export function messageForLanguage(language, key, params = {}) {
  const locale = normalizeLanguage(language);
  const source = sourceMessage(key);
  const translated = INTERFACE_MESSAGES[key]?.[locale] || source;
  return interpolate(translated, params);
}

export function msg(key, params = {}) {
  return messageForLanguage(currentLanguage, key, params);
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
  const next = normalizeLanguage(language);
  const changed = next !== currentLanguage;
  currentLanguage = next;
  document.documentElement.lang = next;
  applyStaticTranslations(document);
  if (changed && notify) {
    const event = new CustomEvent("alantil:languagechange", { detail: { language: next } });
    window.dispatchEvent(event);
    listeners.forEach((listener) => listener(next));
  }
  return next;
}

export function subscribeInterfaceLanguage(listener) {
  listeners.add(listener);
  listener(currentLanguage);
  return () => listeners.delete(listener);
}

export function initializeI18n() {
  setInterfaceLanguage(getUserSettings().interface_language_code, { notify: false });
  if (!unsubscribeSettings) {
    unsubscribeSettings = subscribeUserSettings((settings) => {
      setInterfaceLanguage(settings.interface_language_code);
    });
  }
  return currentLanguage;
}

export function hasCompleteTranslations(language) {
  const locale = normalizeLanguage(language);
  return Object.values(INTERFACE_MESSAGES).every((entry) => Boolean(entry?.[locale]));
}

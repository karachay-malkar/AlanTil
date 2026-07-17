import { ANALYTICS_PREFERENCE_KEY } from "../../config/privacy.js?v=13.8";

const listeners = new Set();

export function hasStoredAnalyticsPreference() {
  try {
    return localStorage.getItem(ANALYTICS_PREFERENCE_KEY) !== null;
  } catch {
    return false;
  }
}

export function readAnalyticsPreference(fallback = false) {
  try {
    const raw = localStorage.getItem(ANALYTICS_PREFERENCE_KEY);
    if (raw === null) return Boolean(fallback);
    return raw === "true";
  } catch {
    return Boolean(fallback);
  }
}

export function saveAnalyticsPreference(enabled) {
  const value = Boolean(enabled);
  try {
    localStorage.setItem(ANALYTICS_PREFERENCE_KEY, String(value));
  } catch {
    // The current session still uses the selected value when storage is unavailable.
  }
  listeners.forEach((listener) => listener(value));
  return value;
}

export function subscribeAnalyticsPreference(listener) {
  if (typeof listener !== "function") return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

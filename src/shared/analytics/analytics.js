import { analyticsEnabled, appVersion, debugMode, measurementId } from "../../config/analytics.js";

const FORBIDDEN_PARAMETER_NAMES = new Set([
  "name", "email", "phone", "telephone", "telegram_id", "telegram_username", "username",
  "exact_location", "latitude", "longitude", "message", "messages", "query", "search_query",
  "free_text", "word", "translation", "lyrics", "text",
]);

let initialized = false;
let scriptRequested = false;
let analyticsContext = { screen_name: "unknown", page_path: window.location.pathname || "/" };

function ensureDataLayer() {
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
  }
  return window.gtag;
}

function sanitizeValue(value) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.slice(0, 300);
  return undefined;
}

export function sanitizeParameters(parameters = {}) {
  const safe = {};
  Object.entries(parameters || {}).forEach(([key, value]) => {
    const normalizedKey = String(key || "").trim();
    if (!normalizedKey || FORBIDDEN_PARAMETER_NAMES.has(normalizedKey.toLowerCase())) return;
    const sanitized = sanitizeValue(value);
    if (sanitized !== undefined) safe[normalizedKey] = sanitized;
  });
  safe.app_version = appVersion;
  if (debugMode) safe.debug_mode = true;
  return safe;
}

export function setAnalyticsContext(nextContext = {}) {
  analyticsContext = { ...analyticsContext, ...sanitizeParameters(nextContext) };
  delete analyticsContext.app_version;
  delete analyticsContext.debug_mode;
}

export function getAnalyticsContext() {
  return { ...analyticsContext };
}

export function setDefaultConsent(overrides = {}) {
  if (!analyticsEnabled) return;
  const gtag = ensureDataLayer();
  gtag("consent", "default", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    wait_for_update: 500,
    ...overrides,
  });
}

export function updateConsent(consent = {}) {
  if (!analyticsEnabled) return;
  ensureDataLayer()("consent", "update", consent);
}

function requestScript() {
  if (scriptRequested || !analyticsEnabled) return;
  scriptRequested = true;
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  script.addEventListener("error", () => {
    if (debugMode) console.warn("[analytics] gtag.js was blocked or unavailable");
  }, { once: true });
  document.head.appendChild(script);
}

export async function initAnalytics() {
  if (initialized || !analyticsEnabled) return initialized;
  initialized = true;
  const gtag = ensureDataLayer();
  setDefaultConsent();
  gtag("js", new Date());
  gtag("config", measurementId, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    debug_mode: debugMode,
  });
  requestScript();
  return true;
}

export function trackEvent(eventName, parameters = {}) {
  if (!analyticsEnabled || !eventName) return false;
  try {
    const safe = sanitizeParameters(parameters);
    if (debugMode) console.info(`[analytics] ${eventName}`, safe);
    ensureDataLayer()("event", eventName, safe);
    return true;
  } catch (error) {
    if (debugMode) console.warn(`[analytics] failed: ${eventName}`, error);
    return false;
  }
}

export function trackPageView(parameters = {}) {
  return trackEvent("page_view", parameters);
}

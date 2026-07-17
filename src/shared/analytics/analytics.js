import { analyticsAvailable, appVersion, debugMode, measurementId } from "../../config/analytics.js?v=13.8.1";

const FORBIDDEN_PARAMETER_NAMES = new Set([
  "name", "email", "phone", "telephone", "telegram_id", "telegram_username", "username",
  "exact_location", "latitude", "longitude", "message", "messages", "query", "search_query",
  "free_text", "word", "translation", "lyrics", "text",
]);

const GA_DISABLE_KEY = `ga-disable-${measurementId}`;
let initialized = false;
let scriptRequested = false;
let defaultConsentSet = false;
let runtimeEnabled = false;
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

function consentPayload(analyticsStorage) {
  return {
    analytics_storage: analyticsStorage,
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  };
}

function setDefaultConsent(analyticsStorage = "denied") {
  if (!analyticsAvailable || defaultConsentSet) return;
  defaultConsentSet = true;
  ensureDataLayer()("consent", "default", {
    ...consentPayload(analyticsStorage),
    wait_for_update: 500,
  });
}

function updateConsent(analyticsStorage) {
  if (!analyticsAvailable) return;
  ensureDataLayer()("consent", "update", consentPayload(analyticsStorage));
}

function requestScript() {
  if (scriptRequested || !analyticsAvailable) return;
  scriptRequested = true;
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  script.addEventListener("error", () => {
    if (debugMode) console.warn("[analytics] gtag.js was blocked or unavailable");
  }, { once: true });
  document.head.appendChild(script);
}

function deleteCookie(name, domain = "") {
  const domainPart = domain ? `; domain=${domain}` : "";
  document.cookie = `${name}=; Max-Age=0; path=/${domainPart}; SameSite=Lax`;
}

function deleteAnalyticsCookies() {
  const hostname = window.location.hostname;
  const domains = ["", hostname, hostname ? `.${hostname}` : ""].filter((value, index, list) => list.indexOf(value) === index);
  document.cookie.split(";").forEach((entry) => {
    const name = entry.split("=")[0]?.trim();
    if (!name || (name !== "_ga" && !name.startsWith("_ga_"))) return;
    domains.forEach((domain) => deleteCookie(name, domain));
  });
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

export function prepareAnalytics() {
  if (!analyticsAvailable) return false;
  window[GA_DISABLE_KEY] = true;
  setDefaultConsent("denied");
  return true;
}

async function enableAnalytics() {
  if (!analyticsAvailable) return false;
  setDefaultConsent("denied");
  window[GA_DISABLE_KEY] = false;
  runtimeEnabled = true;
  updateConsent("granted");

  const gtag = ensureDataLayer();
  if (!initialized) {
    initialized = true;
    gtag("js", new Date());
    gtag("config", measurementId, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      debug_mode: debugMode,
    });
  }
  requestScript();
  return true;
}

function disableAnalytics() {
  if (!analyticsAvailable) return false;
  setDefaultConsent("denied");
  runtimeEnabled = false;
  window[GA_DISABLE_KEY] = true;
  updateConsent("denied");
  deleteAnalyticsCookies();
  return true;
}

export async function setAnalyticsEnabled(enabled) {
  return enabled ? enableAnalytics() : disableAnalytics();
}

export function isAnalyticsEnabled() {
  return runtimeEnabled;
}

export function trackEvent(eventName, parameters = {}) {
  if (!analyticsAvailable || !runtimeEnabled || !eventName) return false;
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

import {
  CIS_COUNTRIES,
  CONSENT_REQUIRED_COUNTRIES,
  PRIVACY_REGION_CACHE_KEY,
  PRIVACY_REGION_ENDPOINT,
  PRIVACY_REGION_TIMEOUT_MS,
} from "../../config/privacy.js?v=13.8";

const consentCountries = new Set(CONSENT_REQUIRED_COUNTRIES);
const cisCountries = new Set(CIS_COUNTRIES);

function normalizeCountryCode(value) {
  const code = String(value || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : "";
}

function readSessionCountry() {
  try {
    return normalizeCountryCode(sessionStorage.getItem(PRIVACY_REGION_CACHE_KEY));
  } catch {
    return "";
  }
}

function saveSessionCountry(countryCode) {
  try {
    sessionStorage.setItem(PRIVACY_REGION_CACHE_KEY, countryCode);
  } catch {
    // Session storage may be unavailable in restricted WebViews.
  }
}

function countryFromBrowserLocale() {
  const languages = Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages
    : [navigator.language];

  for (const language of languages) {
    const match = String(language || "").match(/[-_]([A-Za-z]{2})$/);
    const countryCode = normalizeCountryCode(match?.[1]);
    if (countryCode && (consentCountries.has(countryCode) || cisCountries.has(countryCode))) return countryCode;
  }
  return "";
}

async function fetchCountryCode() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), PRIVACY_REGION_TIMEOUT_MS);
  try {
    const response = await fetch(PRIVACY_REGION_ENDPOINT, {
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Privacy region request failed: ${response.status}`);
    return normalizeCountryCode(await response.text());
  } finally {
    window.clearTimeout(timeout);
  }
}

export function requiresAnalyticsConsent(countryCode) {
  return consentCountries.has(normalizeCountryCode(countryCode));
}

export async function resolvePrivacyRegion() {
  const cached = readSessionCountry();
  if (cached) return { countryCode: cached, consentRequired: requiresAnalyticsConsent(cached), source: "session" };

  try {
    const remote = await fetchCountryCode();
    if (remote) {
      saveSessionCountry(remote);
      return { countryCode: remote, consentRequired: requiresAnalyticsConsent(remote), source: "network" };
    }
  } catch (error) {
    console.warn("privacy-region: country detection failed", error);
  }

  const localeCountry = countryFromBrowserLocale();
  if (localeCountry) {
    return { countryCode: localeCountry, consentRequired: requiresAnalyticsConsent(localeCountry), source: "locale" };
  }

  return { countryCode: "", consentRequired: true, source: "fallback" };
}

import { trackEvent, setAnalyticsEnabled } from "../analytics/analytics.js?v=13.8";
import { EVENTS } from "../analytics/events.js?v=13.8";
import { hideAnalyticsConsentPanel, showAnalyticsConsentPanel } from "../ui/analytics-consent-panel.js?v=13.8";
import {
  hasStoredAnalyticsPreference,
  readAnalyticsPreference,
  saveAnalyticsPreference,
} from "./analytics-preference.js?v=13.8";
import { resolvePrivacyRegion } from "./region-service.js?v=13.8";

const listeners = new Set();
let router = null;
let state = {
  resolved: false,
  enabled: false,
  consentRequired: false,
  countryCode: "",
  source: "initial",
};
let appOpenSent = false;

function notify() {
  const snapshot = { ...state };
  listeners.forEach((listener) => listener(snapshot));
}

async function applyAnalytics(enabled, { persist = false, showPanel = false } = {}) {
  const value = Boolean(enabled);
  if (persist) saveAnalyticsPreference(value);
  state = { ...state, resolved: true, enabled: value };
  await setAnalyticsEnabled(value);
  router?.setAnalyticsActive?.(value);

  if (value && !appOpenSent) {
    appOpenSent = true;
    const current = router?.getCurrent?.();
    trackEvent(EVENTS.APP_OPEN, {
      screen_name: current?.route === "home" ? "home" : String(current?.route || "home").split(".")[0],
    });
  }

  if (showPanel) renderConsentPanel();
  else hideAnalyticsConsentPanel();
  notify();
  return value;
}

function renderConsentPanel() {
  showAnalyticsConsentPanel({
    onDecline() {
      void applyAnalytics(false, { persist: true, showPanel: false });
    },
    onAccept() {
      void applyAnalytics(true, { persist: true, showPanel: false });
    },
    onPrivacy() {
      void router?.navigate?.("settings.privacy", { focus: "analytics" });
    },
  });
}

export async function initPrivacyController({ appRouter } = {}) {
  router = appRouter || router;

  if (hasStoredAnalyticsPreference()) {
    const enabled = readAnalyticsPreference(false);
    state = { ...state, resolved: true, enabled, source: "stored" };
    await applyAnalytics(enabled, { persist: false, showPanel: false });
    return { ...state };
  }

  const region = await resolvePrivacyRegion();
  state = {
    ...state,
    resolved: true,
    consentRequired: region.consentRequired,
    countryCode: region.countryCode,
    source: region.source,
  };

  if (region.consentRequired) {
    await applyAnalytics(false, { persist: false, showPanel: true });
  } else {
    await applyAnalytics(true, { persist: false, showPanel: false });
  }
  return { ...state };
}

export async function updateAnalyticsPreference(enabled) {
  return applyAnalytics(Boolean(enabled), { persist: true, showPanel: false });
}

export function getPrivacyState() {
  return { ...state };
}

export function subscribePrivacyState(listener) {
  if (typeof listener !== "function") return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

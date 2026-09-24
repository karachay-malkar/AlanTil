import { APP_VERSION } from "../../packages/alantil-core/release.js?v=16.7.0.33";

export const measurementId = "G-1WSMD45Q9D";
export const appVersion = APP_VERSION;
export const analyticsAvailable = true;
export const debugMode = new URLSearchParams(window.location.search).get("analytics_debug") === "1";

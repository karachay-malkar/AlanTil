import { getCurrentAuthState } from "../auth/auth-service.js?v=13.15.9";

const VISITOR_STORAGE_KEY = "alantil_analytics_visitor_id_v1";
const SESSION_STORAGE_KEY = "alantil_analytics_session_v1";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let memoryVisitorId = "";
let memorySession = null;
let supabaseClientPromise = null;

function storageOrNull() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function makeUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  if (!bytes.some(Boolean)) {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

function validUuid(value) {
  return UUID_PATTERN.test(String(value || ""));
}

function cleanScopeId(value) {
  const scope = String(value || "").trim();
  return validUuid(scope) ? scope : "";
}

function readVisitorId(storage) {
  try {
    const value = storage?.getItem?.(VISITOR_STORAGE_KEY) || "";
    if (validUuid(value)) return value;
  } catch {
    // Restricted storage falls back to in-memory identity.
  }
  return validUuid(memoryVisitorId) ? memoryVisitorId : "";
}

function writeVisitorId(storage, value) {
  memoryVisitorId = value;
  try {
    storage?.setItem?.(VISITOR_STORAGE_KEY, value);
  } catch {
    // Restricted storage keeps the identity for the current page lifetime only.
  }
}

function readSession(storage) {
  try {
    const raw = storage?.getItem?.(SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (validUuid(parsed?.sessionId) && Number.isFinite(Number(parsed?.lastActivityAt))) {
        return {
          sessionId: parsed.sessionId,
          lastActivityAt: Number(parsed.lastActivityAt),
          scopeId: cleanScopeId(parsed.scopeId),
        };
      }
    }
  } catch {
    // Ignore malformed or unavailable storage.
  }
  if (validUuid(memorySession?.sessionId) && Number.isFinite(Number(memorySession?.lastActivityAt))) {
    return { ...memorySession, scopeId: cleanScopeId(memorySession.scopeId) };
  }
  return null;
}

function writeSession(storage, value) {
  memorySession = { ...value };
  try {
    storage?.setItem?.(SESSION_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Restricted storage keeps the session for the current page lifetime only.
  }
}

export function resolveAnonymousIdentity({
  storage = storageOrNull(),
  nowMs = Date.now(),
  uuidFactory = makeUuid,
  scopeId = "",
} = {}) {
  let visitorId = readVisitorId(storage);
  if (!visitorId) {
    visitorId = uuidFactory();
    if (!validUuid(visitorId)) throw new Error("Visit UUID factory returned an invalid visitor id.");
    writeVisitorId(storage, visitorId);
  }

  const normalizedScope = cleanScopeId(scopeId);
  const previous = readSession(storage);
  const elapsed = previous ? Number(nowMs) - Number(previous.lastActivityAt) : Number.POSITIVE_INFINITY;
  const scopeCompatible = previous && (
    previous.scopeId === normalizedScope
    || (!previous.scopeId && Boolean(normalizedScope))
  );
  const reuse = previous && scopeCompatible && elapsed >= 0 && elapsed <= SESSION_TIMEOUT_MS;
  const sessionId = reuse ? previous.sessionId : uuidFactory();
  if (!validUuid(sessionId)) throw new Error("Visit UUID factory returned an invalid session id.");

  writeSession(storage, { sessionId, lastActivityAt: Number(nowMs), scopeId: normalizedScope });
  return { visitorId, sessionId, isNewSession: !reuse };
}

function cleanPath(value) {
  const path = String(value || "/").split("?")[0].split("#")[0].trim();
  return path.startsWith("/") ? path.slice(0, 300) || "/" : "/";
}

function externalReferrerHost(value) {
  if (!value) return "";
  try {
    const url = new URL(value, window.location.origin);
    if (!url.hostname || url.hostname === window.location.hostname) return "";
    return url.hostname.toLowerCase().slice(0, 253);
  } catch {
    return "";
  }
}

function cleanAppVersion(value) {
  const version = String(value || "unknown").trim().replace(/[^0-9A-Za-z._-]/g, "").slice(0, 32);
  return version || "unknown";
}

async function getAnalyticsSupabaseClient() {
  if (!supabaseClientPromise) {
    supabaseClientPromise = import("../auth/supabase-client.js?v=13.15.9")
      .then(({ getSupabaseClient }) => getSupabaseClient())
      .catch((error) => {
        supabaseClientPromise = null;
        throw error;
      });
  }
  return supabaseClientPromise;
}

export async function recordAnonymousPageView({ pagePath, pageReferrer, appVersion } = {}) {
  try {
    const scopeId = String(getCurrentAuthState().user?.id || "").trim();
    const { visitorId, sessionId } = resolveAnonymousIdentity({ scopeId });
    const client = await getAnalyticsSupabaseClient();
    const { error } = await client.rpc("record_anonymous_visit", {
      p_visitor_id: visitorId,
      p_session_id: sessionId,
      p_page_path: cleanPath(pagePath || window.location.pathname),
      p_referrer_host: externalReferrerHost(pageReferrer || document.referrer) || null,
      p_app_version: cleanAppVersion(appVersion),
    });
    if (error) throw error;
    return true;
  } catch {
    return false;
  }
}

export function clearAnonymousAnalyticsIdentity({ storage = storageOrNull() } = {}) {
  memoryVisitorId = "";
  memorySession = null;
  try {
    storage?.removeItem?.(VISITOR_STORAGE_KEY);
    storage?.removeItem?.(SESSION_STORAGE_KEY);
  } catch {
    // Nothing else is required when persistent storage is unavailable.
  }
}

export const anonymousAnalyticsConfig = Object.freeze({
  visitorStorageKey: VISITOR_STORAGE_KEY,
  sessionStorageKey: SESSION_STORAGE_KEY,
  sessionTimeoutMs: SESSION_TIMEOUT_MS,
});

import { readScopedJson, writeScopedJson } from "./storage-scope.js";

export const ACTIVE_SESSIONS_KEY = "alantil_active_sessions_v1";

function normalizeType(type) {
  const value = String(type || "").trim();
  return ["learn", "test", "match"].includes(value) ? value : "";
}

export function createSessionId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  const random = Math.random().toString(16).slice(2);
  return `${Date.now().toString(16)}-${random}-${Math.random().toString(16).slice(2)}`;
}

export function readActiveSessions(scope) {
  const stored = readScopedJson(ACTIVE_SESSIONS_KEY, {}, scope);
  return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
}

export function getActiveSession(type, scope) {
  const normalized = normalizeType(type);
  if (!normalized) return null;
  return readActiveSessions(scope)[normalized] || null;
}

export function saveActiveSession(type, snapshot, scope) {
  const normalized = normalizeType(type);
  if (!normalized || !snapshot?.id) return false;
  const sessions = readActiveSessions(scope);
  sessions[normalized] = {
    ...snapshot,
    type: normalized,
    saved_at: new Date().toISOString(),
  };
  return writeScopedJson(ACTIVE_SESSIONS_KEY, sessions, scope);
}

export function removeActiveSession(type, scope) {
  const normalized = normalizeType(type);
  if (!normalized) return false;
  const sessions = readActiveSessions(scope);
  if (!sessions[normalized]) return true;
  delete sessions[normalized];
  return writeScopedJson(ACTIVE_SESSIONS_KEY, sessions, scope);
}

export function clearActiveSessions(scope) {
  return writeScopedJson(ACTIVE_SESSIONS_KEY, {}, scope);
}

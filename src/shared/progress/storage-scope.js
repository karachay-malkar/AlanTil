const STORAGE_SCOPE_PREFIX = "alantil_scope_v1";
const GUEST_SCOPE = "guest";
const listeners = new Set();

let activeScope = GUEST_SCOPE;

function safeParse(raw, fallback) {
  if (raw === null || raw === undefined) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function notifyScopeChanged() {
  listeners.forEach((listener) => {
    try {
      listener(activeScope);
    } catch (error) {
      console.error("Storage scope subscriber failed", error);
    }
  });
}

function isInactiveGuestScope(scope) {
  return String(scope || "") === GUEST_SCOPE && activeScope !== GUEST_SCOPE;
}

export function storageScopeForUser(userId) {
  const normalized = String(userId || "").trim();
  return normalized ? `user:${normalized}` : GUEST_SCOPE;
}

export function getStorageScope() {
  return activeScope;
}

export function getStorageScopeUserId(scope = activeScope) {
  const value = String(scope || "");
  return value.startsWith("user:") ? value.slice(5) : "";
}

export function isGuestStorageScope(scope = activeScope) {
  return scope === GUEST_SCOPE;
}

export function setStorageScope(userId) {
  const nextScope = storageScopeForUser(userId);
  if (nextScope === activeScope) return activeScope;
  activeScope = nextScope;
  notifyScopeChanged();
  return activeScope;
}

export function scopedStorageKey(baseKey, scope = activeScope) {
  return `${STORAGE_SCOPE_PREFIX}:${String(scope || GUEST_SCOPE)}:${String(baseKey || "")}`;
}

export function readScopedJson(baseKey, fallback, scope = activeScope) {
  // Guest data is deliberately inaccessible while an account scope is active.
  // This prevents legacy claim logic from copying guest progress into accounts,
  // while preserving that guest progress for the next signed-out visit.
  if (isInactiveGuestScope(scope)) return fallback;
  try {
    return safeParse(localStorage.getItem(scopedStorageKey(baseKey, scope)), fallback);
  } catch {
    return fallback;
  }
}

export function writeScopedJson(baseKey, value, scope = activeScope) {
  if (isInactiveGuestScope(scope)) return false;
  try {
    localStorage.setItem(scopedStorageKey(baseKey, scope), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeScopedValue(baseKey, scope = activeScope) {
  if (isInactiveGuestScope(scope)) return false;
  try {
    localStorage.removeItem(scopedStorageKey(baseKey, scope));
    return true;
  } catch {
    return false;
  }
}

export function hasScopedValue(baseKey, scope = activeScope) {
  if (isInactiveGuestScope(scope)) return false;
  try {
    return localStorage.getItem(scopedStorageKey(baseKey, scope)) !== null;
  } catch {
    return false;
  }
}

export function migrateLegacyValueToGuest(baseKey) {
  try {
    const guestKey = scopedStorageKey(baseKey, GUEST_SCOPE);
    const legacy = localStorage.getItem(baseKey);
    if (legacy === null) return false;
    if (localStorage.getItem(guestKey) === null) localStorage.setItem(guestKey, legacy);
    localStorage.removeItem(baseKey);
    return true;
  } catch {
    return false;
  }
}

export function subscribeStorageScope(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const STORAGE_SCOPES = Object.freeze({ GUEST: GUEST_SCOPE });

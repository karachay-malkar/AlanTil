import { subscribeToAuth } from "../auth/auth-service.js?v=13.15.9";
import { getSupabaseClient } from "../auth/supabase-client.js?v=13.15.9";

let unsubscribeAuth = null;
let requestVersion = 0;
let currentAccess = false;
let currentSubject = "pending";
let accessReadyState = false;
let readyResolve = null;
let accessReady = createAccessReadyPromise();

function createAccessReadyPromise() {
  return new Promise((resolve) => { readyResolve = resolve; });
}

function resetAccessReady() {
  accessReadyState = false;
  accessReady = createAccessReadyPromise();
}

function markAccessReady() {
  if (accessReadyState) return;
  accessReadyState = true;
  readyResolve?.();
  readyResolve = null;
}

function publishAccess(value) {
  currentAccess = Boolean(value);
  document.documentElement.dataset.activityAccess = String(currentAccess);
  window.dispatchEvent(new CustomEvent("alantil:activity-access", { detail: { enabled: currentAccess } }));
  return currentAccess;
}

async function refreshAccess(authState) {
  if (!authState?.ready) return currentAccess;

  const userId = String(authState?.user?.id || "").trim();
  const subject = userId || "guest";
  if (subject !== currentSubject) {
    currentSubject = subject;
    requestVersion += 1;
    resetAccessReady();
    publishAccess(false);
  }

  const version = ++requestVersion;
  if (!userId) {
    if (version === requestVersion) markAccessReady();
    return publishAccess(false);
  }

  try {
    const client = await getSupabaseClient();
    const { data, error } = await client
      .from("profiles")
      .select("activity_access")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (version !== requestVersion) return currentAccess;
    return publishAccess(data?.activity_access === true);
  } catch (error) {
    if (version === requestVersion) publishAccess(false);
    console.warn("Activity access check failed", error);
    return false;
  } finally {
    if (version === requestVersion) markAccessReady();
  }
}

export function initAdminAccess() {
  if (unsubscribeAuth) return unsubscribeAuth;
  publishAccess(false);
  unsubscribeAuth = subscribeToAuth((authState) => {
    void refreshAccess(authState);
  });
  return unsubscribeAuth;
}

export function hasActivityAccess() {
  return currentAccess;
}

export function whenActivityAccessReady() {
  return accessReady;
}

export function disposeAdminAccess() {
  requestVersion += 1;
  unsubscribeAuth?.();
  unsubscribeAuth = null;
  currentSubject = "pending";
  resetAccessReady();
  publishAccess(false);
}

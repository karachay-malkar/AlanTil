import { msg } from "../i18n/index.js?v=13.10.3";
import { getAuthRedirectUrl } from "../../config/supabase.js?v=13.10.3";
import { getAuthState, setAuthState, subscribeAuthState } from "./auth-store.js?v=13.10.3";
import { getSupabaseClient, hasPersistedAuthSession } from "./supabase-client.js?v=13.10.3";

const CALLBACK_KEYS = ["code", "error", "error_code", "error_description"];
const AUTH_REQUEST_TIMEOUT_MS = 60000;
const AUTH_RETRY_DELAYS_MS = [0, 1500, 5000, 15000];
const AUTH_DESTINATION_PATH = "/profile/account";

let initializationPromise = null;
let authSubscription = null;
let callbackPromise = null;

const sleep = (ms) => new Promise((resolve) => globalThis.setTimeout(resolve, ms));

function withTimeout(value, label, timeoutMs = AUTH_REQUEST_TIMEOUT_MS) {
  let timer = 0;
  return Promise.race([
    Promise.resolve(value),
    new Promise((_, reject) => {
      timer = globalThis.setTimeout(() => reject(new Error(`${label} timeout`)), timeoutMs);
    }),
  ]).finally(() => globalThis.clearTimeout(timer));
}

function isRetryable(error) {
  return /network|fetch|load failed|timeout|offline/i.test(String(error?.message || error));
}

async function retryAuth(operation, label) {
  let lastError = null;
  for (const waitMs of AUTH_RETRY_DELAYS_MS) {
    if (waitMs) await sleep(waitMs);
    if (globalThis.navigator && navigator.onLine === false) throw new Error("Offline");
    try {
      return await withTimeout(operation(), label);
    } catch (error) {
      lastError = error;
      if (!isRetryable(error)) throw error;
    }
  }
  throw lastError || new Error(`${label} failed`);
}

function authMessage(error, fallback = msg("service.ne_udalos_vypolnit_vhod")) {
  const value = String(error?.message || error || "");
  if (/rate limit|too many requests/i.test(value)) return msg("service.slishkom_mnogo_popytok_povtorite_pozzhe");
  if (isRetryable(error)) return msg("service.ne_udalos_svyazatsya_s_servisom_avtorizatsii");
  return fallback;
}

function applySession(session, error = null) {
  return setAuthState({
    ready: true,
    session: session || null,
    user: session?.user || null,
    error,
  });
}

function bindAuthEvents(client) {
  if (authSubscription) return;
  const { data } = client.auth.onAuthStateChange((event, session) => {
    applySession(event === "SIGNED_OUT" ? null : session, null);
  });
  authSubscription = data.subscription;
}

function callbackParams() {
  const params = new URLSearchParams(window.location.search || "");
  return {
    code: String(params.get("code") || "").trim(),
    error: String(params.get("error_description") || params.get("error") || "").trim(),
    present: CALLBACK_KEYS.some((key) => params.has(key)),
  };
}

function clearCallbackUrl() {
  const url = new URL(window.location.href);
  CALLBACK_KEYS.forEach((key) => url.searchParams.delete(key));
  const search = url.searchParams.toString();
  window.history.replaceState(window.history.state, "", `${AUTH_DESTINATION_PATH}${search ? `?${search}` : ""}${url.hash}`);
}

export function hasAuthCallback(locationObject = window.location) {
  const params = new URLSearchParams(locationObject.search || "");
  return CALLBACK_KEYS.some((key) => params.has(key));
}

async function handleAuthCallback(client) {
  const callback = callbackParams();
  if (!callback.present) return false;
  if (callback.error || !callback.code) {
    applySession(null, msg("service.ne_udalos_zavershit_vhod_cherez_google"));
    clearCallbackUrl();
    return true;
  }
  if (!callbackPromise) {
    callbackPromise = retryAuth(() => client.auth.exchangeCodeForSession(callback.code), "Auth callback")
      .then(({ data, error }) => {
        if (error) throw error;
        if (!data?.session?.user) throw new Error("Session was not created");
        applySession(data.session, null);
      })
      .catch((error) => applySession(null, authMessage(error, msg("service.ne_udalos_zavershit_vhod_cherez_google"))))
      .finally(() => {
        clearCallbackUrl();
        callbackPromise = null;
      });
  }
  await callbackPromise;
  return true;
}

function startAuthInitialization() {
  if (initializationPromise) return initializationPromise;
  initializationPromise = (async () => {
    try {
      const callbackPresent = hasAuthCallback();
      if (!callbackPresent && !hasPersistedAuthSession()) {
        return applySession(null, null);
      }

      const client = await getSupabaseClient();
      const callbackHandled = await handleAuthCallback(client);
      if (!callbackHandled) {
        const { data, error } = await withTimeout(client.auth.getSession(), "Auth session", 15000);
        if (error) throw error;
        applySession(data.session || null, null);
      }
      bindAuthEvents(client);
    } catch (error) {
      const current = getAuthState();
      setAuthState({ ...current, ready: true, error: authMessage(error, msg("service.ne_udalos_proverit_sostoyanie_akkaunta")) });
    }
    return getAuthState();
  })();
  return initializationPromise;
}

export async function initializeAuth() {
  void startAuthInitialization();
  return getAuthState();
}

export function waitForAuthInitialization() {
  return startAuthInitialization();
}

export async function signInWithGoogleCredential(token, nonce) {
  const credential = String(token || "").trim();
  const rawNonce = String(nonce || "").trim();
  if (!credential || !rawNonce) throw new Error(msg("service.ne_udalos_vypolnit_vhod"));
  const result = await retryAuth(async () => {
    const client = await getSupabaseClient();
    const response = await client.auth.signInWithIdToken({
      provider: "google",
      token: credential,
      nonce: rawNonce,
    });
    return { client, ...response };
  }, "Google sign in");
  if (result.error) throw new Error(authMessage(result.error));
  if (!result.data?.session?.user) throw new Error(msg("service.sessiya_ne_byla_sozdana"));
  bindAuthEvents(result.client);
  applySession(result.data.session, null);
  return result.data;
}

export async function signInWithProvider(provider) {
  const normalized = String(provider || "").trim().toLowerCase();
  if (normalized !== "apple") throw new Error(msg("service.ne_udalos_vypolnit_vhod"));
  const result = await retryAuth(async () => {
    const client = await getSupabaseClient();
    const response = await client.auth.signInWithOAuth({
      provider: normalized,
      options: { redirectTo: getAuthRedirectUrl() },
    });
    return response;
  }, "OAuth sign in");
  if (result.error) throw new Error(authMessage(result.error));
  return result.data;
}

export async function signOut() {
  const client = await getSupabaseClient();
  const { error } = await withTimeout(client.auth.signOut({ scope: "local" }), "Sign out", 30000);
  if (error) throw new Error(authMessage(error));
  applySession(null, null);
}

export function getCurrentAuthState() { return getAuthState(); }
export function subscribeToAuth(subscriber) { return subscribeAuthState(subscriber); }
export function getUserProvider(user) {
  const provider = String(user?.app_metadata?.provider || "").toLowerCase();
  if (provider === "google") return "Google";
  if (provider === "apple") return "Apple";
  return provider || msg("service.ne_opredelen");
}

export function disposeAuth() {
  authSubscription?.unsubscribe?.();
  authSubscription = null;
  initializationPromise = null;
  callbackPromise = null;
}

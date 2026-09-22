import { msg } from "../i18n/index.js?v=13.10.12";
import { getAuthRedirectUrl } from "../../config/supabase.js?v=13.10.12";
import { getAuthState, setAuthState, subscribeAuthState } from "./auth-store.js?v=13.10.12";
import { getSupabaseClient, hasPersistedAuthSession } from "./supabase-client.js?v=13.10.12";

const CALLBACK_KEYS = ["code", "error", "error_code", "error_description"];
const OAUTH_PROVIDERS = new Set(["google", "apple"]);
const AUTH_REQUEST_TIMEOUT_MS = 15000;
const AUTH_DESTINATION_PATH = "/path/understanding";

let initializationPromise = null;
let authSubscription = null;
let callbackPromise = null;
const preparedOAuthRedirects = new Map();

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

function isRedirectConfigurationError(value) {
  return /(?:redirect(?:_to)?|redirect url|callback url|return url|requested path).*(?:not allowed|not permitted|invalid|allow list)|not in (?:the )?allow list/i.test(String(value || ""));
}

function authMessage(error, fallback = msg("service.ne_udalos_vypolnit_vhod")) {
  const value = String(error?.message || error || "");
  if (isRedirectConfigurationError(value)) return msg("service.ssylka_vozvrata_ne_razreshena_v_supabase");
  if (/blocked|banned|signup.*disabled|регистрац/i.test(value)) {
    return msg("service.vhod_ili_registratsiya_dlya_etogo_adresa_nedostupny");
  }
  if (/rate limit|too many requests/i.test(value)) return msg("service.slishkom_mnogo_popytok_povtorite_pozzhe");
  if (isRetryable(error)) return msg("service.ne_udalos_svyazatsya_s_servisom_avtorizatsii");
  return fallback;
}

function callbackAuthMessage(error, fallback = msg("service.ne_udalos_zavershit_vhod_cherez_google")) {
  const value = String(error?.message || error || "").trim();
  return value || fallback;
}

function normalizeOAuthProvider(provider) {
  const normalized = String(provider || "").trim().toLowerCase();
  if (!OAUTH_PROVIDERS.has(normalized)) throw new Error(msg("service.ne_udalos_vypolnit_vhod"));
  return normalized;
}

export function prepareSignInWithProvider(provider) {
  const normalized = normalizeOAuthProvider(provider);
  const existing = preparedOAuthRedirects.get(normalized);
  if (existing) return existing;

  const prepared = (async () => {
    const client = await withTimeout(getSupabaseClient(), "Supabase client");
    const options = {
      redirectTo: getAuthRedirectUrl(),
      skipBrowserRedirect: true,
    };
    if (normalized === "google") options.queryParams = { prompt: "select_account" };

    const { data, error } = await withTimeout(
      client.auth.signInWithOAuth({ provider: normalized, options }),
      "OAuth start",
    );
    if (error) throw error;
    const url = String(data?.url || "").trim();
    if (!url) throw new Error(msg("service.ne_udalos_vypolnit_vhod"));
    return url;
  })().catch((error) => {
    preparedOAuthRedirects.delete(normalized);
    throw error;
  });

  preparedOAuthRedirects.set(normalized, prepared);
  return prepared;
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

function callbackParams(locationObject = window.location) {
  const query = new URLSearchParams(locationObject.search || "");
  const hash = new URLSearchParams(String(locationObject.hash || "").replace(/^#/, ""));
  const read = (key) => String(query.get(key) || hash.get(key) || "").trim();
  return {
    code: read("code"),
    error: read("error_description") || read("error") || read("error_code"),
    present: CALLBACK_KEYS.some((key) => query.has(key) || hash.has(key)),
  };
}

function clearCallbackUrl() {
  const url = new URL(window.location.href);
  CALLBACK_KEYS.forEach((key) => url.searchParams.delete(key));
  const rawHash = String(url.hash || "");
  const hashParams = new URLSearchParams(rawHash.replace(/^#/, ""));
  const authHashPresent = CALLBACK_KEYS.some((key) => hashParams.has(key));
  if (authHashPresent) CALLBACK_KEYS.forEach((key) => hashParams.delete(key));
  const search = url.searchParams.toString();
  const hash = authHashPresent ? hashParams.toString() : rawHash.replace(/^#/, "");
  window.history.replaceState(window.history.state, "", `${AUTH_DESTINATION_PATH}${search ? `?${search}` : ""}${hash ? `#${hash}` : ""}`);
}

function consumeAuthCallback() {
  preparedOAuthRedirects.clear();
  clearCallbackUrl();
}

export function hasAuthCallback(locationObject = window.location) {
  const query = new URLSearchParams(locationObject.search || "");
  const hash = new URLSearchParams(String(locationObject.hash || "").replace(/^#/, ""));
  return CALLBACK_KEYS.some((key) => query.has(key) || hash.has(key));
}

async function handleAuthCallback(client) {
  const callback = callbackParams();
  if (!callback.present) return false;

  try {
    if (callback.error) throw new Error(callback.error);
    if (!callback.code) throw new Error("OAuth callback is missing the authorization code");

    if (!callbackPromise) {
      callbackPromise = (async () => {
        const { data, error } = await withTimeout(
          client.auth.exchangeCodeForSession(callback.code),
          "Auth callback",
        );
        if (error) throw error;
        if (!data?.session?.user) throw new Error("Session was not created");
        applySession(data.session, null);
        return data.session;
      })().finally(() => {
        callbackPromise = null;
      });
    }

    await callbackPromise;
    return true;
  } catch (error) {
    applySession(null, callbackAuthMessage(error));
    return true;
  } finally {
    consumeAuthCallback();
  }
}

function startAuthInitialization() {
  if (initializationPromise) return initializationPromise;
  initializationPromise = (async () => {
    const callbackPresent = hasAuthCallback();
    try {
      if (!callbackPresent && !hasPersistedAuthSession()) {
        return applySession(null, null);
      }

      const client = await withTimeout(getSupabaseClient(), "Supabase client");
      const callbackHandled = await handleAuthCallback(client);
      if (!callbackHandled) {
        const { data, error } = await withTimeout(client.auth.getSession(), "Auth session");
        if (error) throw error;
        applySession(data.session || null, null);
      }
      bindAuthEvents(client);
    } catch (error) {
      if (callbackPresent) consumeAuthCallback();
      const current = getAuthState();
      setAuthState({
        ...current,
        ready: true,
        error: callbackPresent
          ? callbackAuthMessage(error)
          : authMessage(error, msg("service.ne_udalos_proverit_sostoyanie_akkaunta")),
      });
    }
    return getAuthState();
  })();
  return initializationPromise;
}

export async function initializeAuth() {
  return startAuthInitialization();
}

export function waitForAuthInitialization() {
  return startAuthInitialization();
}

// Kept for compatibility with older cached account modules.
export async function signInWithGoogleCredential(token, nonce) {
  const credential = String(token || "").trim();
  const rawNonce = String(nonce || "").trim();
  if (!credential || !rawNonce) throw new Error(msg("service.ne_udalos_vypolnit_vhod"));

  try {
    const client = await withTimeout(getSupabaseClient(), "Supabase client");
    const { data, error } = await withTimeout(client.auth.signInWithIdToken({
      provider: "google",
      token: credential,
      nonce: rawNonce,
    }), "Google token sign in");
    if (error) throw error;
    if (!data?.session?.user) throw new Error(msg("service.sessiya_ne_byla_sozdana"));
    bindAuthEvents(client);
    applySession(data.session, null);
    return data;
  } catch (error) {
    throw new Error(authMessage(error));
  }
}

export async function signInWithProvider(provider) {
  const normalized = normalizeOAuthProvider(provider);

  setAuthState({ error: null });
  try {
    const url = await prepareSignInWithProvider(normalized);
    window.location.href = url;
    return { provider: normalized, url };
  } catch (error) {
    throw new Error(authMessage(error));
  }
}

export async function signOut() {
  try {
    const client = await withTimeout(getSupabaseClient(), "Supabase client");
    const { error } = await withTimeout(client.auth.signOut({ scope: "local" }), "Sign out");
    if (error) throw error;
    applySession(null, null);
  } catch (error) {
    throw new Error(authMessage(error));
  }
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
  preparedOAuthRedirects.clear();
}

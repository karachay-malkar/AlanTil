import { msg } from "../i18n/index.js?v=13.10.4";
import { getAuthRedirectUrl } from "../../config/supabase.js?v=13.10.4";
import { getAuthState, setAuthState, subscribeAuthState } from "./auth-store.js?v=13.10.4";
import { getSupabaseClient, hasPersistedAuthSession } from "./supabase-client.js?v=13.10.4";

const CALLBACK_KEYS = ["code", "error", "error_code", "error_description"];
const OAUTH_PROVIDERS = new Set(["google", "apple"]);
const AUTH_REQUEST_TIMEOUT_MS = 15000;
const AUTH_DESTINATION_PATH = "/profile/account";

let initializationPromise = null;
let authSubscription = null;
let callbackPromise = null;

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
    callbackPromise = (async () => {
      try {
        const { data, error } = await withTimeout(
          client.auth.exchangeCodeForSession(callback.code),
          "Auth callback",
        );
        if (error) throw error;
        if (!data?.session?.user) throw new Error("Session was not created");
        applySession(data.session, null);
      } catch (error) {
        applySession(null, authMessage(error, msg("service.ne_udalos_zavershit_vhod_cherez_google")));
      } finally {
        clearCallbackUrl();
      }
    })().finally(() => {
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

      const client = await withTimeout(getSupabaseClient(), "Supabase client");
      const callbackHandled = await handleAuthCallback(client);
      if (!callbackHandled) {
        const { data, error } = await withTimeout(client.auth.getSession(), "Auth session");
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

// Retained only for compatibility with an older account module. The current
// web sign-in button uses signInWithProvider("google") and redirect OAuth.
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
  const normalized = String(provider || "").trim().toLowerCase();
  if (!OAUTH_PROVIDERS.has(normalized)) throw new Error(msg("service.ne_udalos_vypolnit_vhod"));

  setAuthState({ error: null });
  try {
    const client = await withTimeout(getSupabaseClient(), "Supabase client");
    const options = { redirectTo: getAuthRedirectUrl() };
    if (normalized === "google") options.queryParams = { prompt: "select_account" };

    const { data, error } = await withTimeout(client.auth.signInWithOAuth({
      provider: normalized,
      options,
    }), "OAuth sign in");
    if (error) throw error;
    return data;
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
}

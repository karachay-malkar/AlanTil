import { msg } from "../i18n/index.js?v=13.10.0";
import { getAuthRedirectUrl } from "../../config/supabase.js?v=13.9.0";
import { getAuthState, setAuthState, subscribeAuthState } from "./auth-store.js?v=13.9.0";
import { getSupabaseClient } from "./supabase-client.js?v=13.10.0";

const AUTH_CALLBACK_PARAMETERS = Object.freeze([
  "code",
  "error",
  "error_code",
  "error_description",
]);
const OAUTH_PROVIDERS = new Set(["google", "apple"]);
const AUTH_REQUEST_TIMEOUT_MS = 7000;

let initializationPromise = null;
let authSubscription = null;
let callbackExchangeCode = "";
let callbackExchangePromise = null;
const successfulCallbackCodes = new Set();

function withTimeout(value, timeoutMs = AUTH_REQUEST_TIMEOUT_MS, label = "Auth request") {
  let timer = 0;
  return Promise.race([
    Promise.resolve(value),
    new Promise((_, reject) => {
      timer = globalThis.setTimeout(() => {
        const error = new Error(`${label} timeout`);
        error.code = "ALANTIL_TIMEOUT";
        reject(error);
      }, timeoutMs);
    }),
  ]).finally(() => globalThis.clearTimeout(timer));
}

function isRedirectConfigurationError(value) {
  return /(?:redirect(?:_to)?|redirect url|callback url|return url|requested path).*(?:not allowed|not permitted|invalid|allow list)|not in (?:the )?allow list/i.test(value);
}

function normalizeAuthError(error, fallback = msg("service.ne_udalos_vypolnit_vhod")) {
  const message = String(error?.message || error || "").trim();
  if (!message) return fallback;
  if (isRedirectConfigurationError(message)) {
    return msg("service.ssylka_vozvrata_ne_razreshena_v_supabase");
  }
  if (/blocked|banned|signup.*disabled|регистрац/i.test(message)) {
    return msg("service.vhod_ili_registratsiya_dlya_etogo_adresa_nedostupny");
  }
  if (/rate limit|too many requests/i.test(message)) {
    return msg("service.slishkom_mnogo_popytok_povtorite_pozzhe");
  }
  if (/network|fetch|failed to fetch|load failed|timeout/i.test(message)) {
    return msg("service.ne_udalos_svyazatsya_s_servisom_avtorizatsii");
  }
  return fallback;
}

function normalizeCallbackError(error) {
  const message = String(error?.message || error || "").trim();
  if (isRedirectConfigurationError(message)) {
    return msg("service.ssylka_vozvrata_ne_razreshena_v_supabase");
  }
  return msg("service.ne_udalos_zavershit_vhod_cherez_google");
}

function readCallbackParameters(locationObject = window.location) {
  const parameters = new URLSearchParams(locationObject.search || "");
  return {
    code: parameters.get("code"),
    hasCode: parameters.has("code"),
    error: parameters.get("error"),
    errorCode: parameters.get("error_code"),
    errorDescription: parameters.get("error_description"),
    hasCallbackParameters: AUTH_CALLBACK_PARAMETERS.some((name) => parameters.has(name)),
  };
}

function cleanAuthCallbackUrl({ removeCode = true } = {}) {
  const url = new URL(window.location.href);
  AUTH_CALLBACK_PARAMETERS.forEach((name) => {
    if (name === "code" && !removeCode) return;
    url.searchParams.delete(name);
  });
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", nextUrl || "/account");
}

function setSessionState(session, error = null) {
  return setAuthState({
    ready: true,
    session: session || null,
    user: session?.user || null,
    error,
  });
}

function ensureAuthSubscription(client) {
  if (authSubscription) return authSubscription;
  const { data: listener } = client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      setSessionState(null, null);
      return;
    }
    const currentError = getAuthState().error;
    setSessionState(session, event === "INITIAL_SESSION" ? currentError : null);
  });
  authSubscription = listener.subscription;
  return authSubscription;
}

export function hasAuthCallback(locationObject = window.location) {
  return readCallbackParameters(locationObject).hasCallbackParameters;
}

export async function handleAuthCallback(clientOverride = null) {
  const callback = readCallbackParameters();
  if (!callback.hasCallbackParameters) return { handled: false, success: false };

  if (callback.error || callback.errorCode || callback.errorDescription) {
    const sourceMessage = [callback.error, callback.errorCode, callback.errorDescription].filter(Boolean).join(" ");
    const message = isRedirectConfigurationError(sourceMessage)
      ? msg("service.ssylka_vozvrata_ne_razreshena_v_supabase")
      : msg("service.ne_udalos_zavershit_vhod_cherez_google");
    setAuthState({ ready: true, error: message });
    cleanAuthCallbackUrl({ removeCode: false });
    return { handled: true, success: false, error: message };
  }

  if (!callback.hasCode || !String(callback.code || "").trim()) {
    const message = msg("service.kod_avtorizatsii_otsutstvuet");
    setAuthState({ ready: true, error: message });
    return { handled: true, success: false, error: message };
  }

  const code = String(callback.code).trim();
  if (successfulCallbackCodes.has(code)) {
    const current = getAuthState();
    cleanAuthCallbackUrl({ removeCode: true });
    return {
      handled: true,
      success: Boolean(current.session && current.user),
      session: current.session || null,
      user: current.user || null,
      error: current.session && current.user ? null : msg("service.sessiya_ne_byla_sozdana"),
    };
  }
  if (callbackExchangeCode === code && callbackExchangePromise) return callbackExchangePromise;

  callbackExchangeCode = code;
  callbackExchangePromise = (async () => {
    try {
      const client = clientOverride || await getSupabaseClient();
      const { data, error } = await withTimeout(client.auth.exchangeCodeForSession(code), AUTH_REQUEST_TIMEOUT_MS, "Auth callback");
      if (error) throw error;

      const session = data?.session || null;
      const user = data?.user || session?.user || null;
      if (!session || !user) {
        const message = msg("service.sessiya_ne_byla_sozdana");
        setAuthState({ ready: true, session: null, user: null, error: message });
        return { handled: true, success: false, error: message };
      }

      setAuthState({ ready: true, session, user, error: null });
      successfulCallbackCodes.add(code);
      cleanAuthCallbackUrl({ removeCode: true });
      return { handled: true, success: true, session, user };
    } catch (error) {
      const message = normalizeCallbackError(error);
      setAuthState({ ready: true, session: null, user: null, error: message });
      return { handled: true, success: false, error: message };
    }
  })().finally(() => {
    callbackExchangePromise = null;
  });

  return callbackExchangePromise;
}

function startAuthInitialization() {
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    try {
      const client = await getSupabaseClient();
      const callbackResult = await handleAuthCallback(client);

      if (!callbackResult.handled || !callbackResult.success) {
        const { data, error } = await withTimeout(client.auth.getSession(), 5000, "Auth session");
        if (error) throw error;
        setSessionState(data.session || null, callbackResult.handled ? callbackResult.error || null : null);
      }

      ensureAuthSubscription(client);
      return getAuthState();
    } catch (error) {
      const current = getAuthState();
      const message = hasAuthCallback()
        ? normalizeCallbackError(error)
        : normalizeAuthError(error, msg("service.ne_udalos_proverit_sostoyanie_akkaunta"));
      setAuthState({
        ready: true,
        session: current.session || null,
        user: current.user || null,
        error: message,
      });
      return getAuthState();
    }
  })();

  return initializationPromise;
}

// Start the check, but never hold the application shell while the network or
// an external module is unavailable. Consumers receive updates via subscribeToAuth.
export async function initializeAuth() {
  void startAuthInitialization();
  return getAuthState();
}

export function waitForAuthInitialization() {
  return startAuthInitialization();
}

export async function signInWithProvider(provider) {
  const normalized = String(provider || "").trim().toLowerCase();
  if (!OAUTH_PROVIDERS.has(normalized)) throw new Error(msg("service.ne_udalos_vypolnit_vhod"));

  setAuthState({ error: null });
  const client = await getSupabaseClient();
  const options = { redirectTo: getAuthRedirectUrl() };
  if (normalized === "google") options.queryParams = { prompt: "select_account" };
  const { data, error } = await withTimeout(client.auth.signInWithOAuth({
    provider: normalized,
    options,
  }), AUTH_REQUEST_TIMEOUT_MS, "OAuth sign in");
  if (error) throw new Error(normalizeAuthError(error));
  return data;
}

export function signInWithGoogle() {
  return signInWithProvider("google");
}

// Kept temporarily for module compatibility. Email sign-in is removed from
// the interface and cannot start an authentication request.
export async function signInWithEmail() {
  throw new Error(msg("service.ne_udalos_vypolnit_vhod"));
}

export async function signOut() {
  setAuthState({ error: null });
  const client = await getSupabaseClient();
  const { error } = await withTimeout(client.auth.signOut({ scope: "local" }), 5000, "Sign out");
  if (error) throw new Error(normalizeAuthError(error));
  setSessionState(null, null);
}

export function getCurrentAuthState() {
  return getAuthState();
}

export function subscribeToAuth(subscriber) {
  return subscribeAuthState(subscriber);
}

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
  callbackExchangeCode = "";
  callbackExchangePromise = null;
  successfulCallbackCodes.clear();
}

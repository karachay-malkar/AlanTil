import { msg } from "../i18n/index.js?v=16.8.0.3";
import { getAuthRedirectUrl } from "../../config/supabase.js?v=16.8.0.3";
import { getAuthState, setAuthState, subscribeAuthState } from "./auth-store.js?v=16.8.0.3";
import { getSupabaseClient, hasPersistedAuthSession } from "./supabase-client.js?v=16.8.0.3";

const CALLBACK_KEYS = ["code", "error", "error_code", "error_description"];
const AUTH_FLOW_KEY = "auth_flow";
const AUTH_FLOW_STORAGE_KEY = "alantil_auth_flow_v1";
const OAUTH_PROVIDERS = new Set(["google", "apple"]);
const KNOWN_AUTH_FLOWS = new Set(["legacy_google", "recovery", "signup"]);
const PASSWORD_SETUP_FLOWS = new Set(["legacy_google", "recovery"]);
const AUTH_REQUEST_TIMEOUT_MS = 15000;
const AUTH_DESTINATION_PATH = "/path/roots";
const ACCOUNT_DESTINATION_PATH = "/profile/account";
const MIN_PASSWORD_LENGTH = 6;

let initializationPromise = null;
let authSubscription = null;
let callbackPromise = null;
const preparedOAuthRedirects = new Map();

function withTimeout(value, label, timeoutMs = AUTH_REQUEST_TIMEOUT_MS) {
  let timer = 0;
  return Promise.race([
    Promise.resolve(value),
    new Promise((_, reject) => {
      timer = globalThis.setTimeout(() => reject(new Error(label + " timeout")), timeoutMs);
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
  if (/invalid login credentials|invalid credentials/i.test(value)) return msg("service.nevernaya_pochta_ili_parol");
  if (/email not confirmed/i.test(value)) return msg("service.podtverdite_elektronnuyu_pochtu");
  if (/password.*(?:at least|short|characters)|weak password/i.test(value)) return msg("account.parol_min_6");
  if (/blocked|banned|signup.*disabled|регистрац/i.test(value)) {
    return msg("service.vhod_ili_registratsiya_dlya_etogo_adresa_nedostupny");
  }
  if (/rate limit|too many requests/i.test(value)) return msg("service.slishkom_mnogo_popytok_povtorite_pozzhe");
  if (isRetryable(error)) return msg("service.ne_udalos_svyazatsya_s_servisom_avtorizatsii");
  return fallback;
}

function callbackAuthMessage(error, fallback = msg("service.ne_udalos_zavershit_avtorizatsiyu")) {
  const value = String(error?.message || error || "").trim();
  return value || fallback;
}

function normalizeOAuthProvider(provider) {
  const normalized = String(provider || "").trim().toLowerCase();
  if (!OAUTH_PROVIDERS.has(normalized)) throw new Error(msg("service.ne_udalos_vypolnit_vhod"));
  return normalized;
}

function normalizeAuthFlow(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return KNOWN_AUTH_FLOWS.has(normalized) ? normalized : "";
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePassword(value) {
  return String(value || "");
}

function validateEmail(value) {
  const email = normalizeEmail(value);
  if (!email || !email.includes("@")) throw new Error(msg("service.vvedite_elektronnuyu_pochtu"));
  return email;
}

function validatePassword(value) {
  const password = normalizePassword(value);
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error(msg("account.parol_min_6"));
  return password;
}

function readPersistedAuthFlow() {
  try {
    return normalizeAuthFlow(sessionStorage.getItem(AUTH_FLOW_STORAGE_KEY));
  } catch {
    return "";
  }
}

function persistAuthFlow(flow) {
  const normalized = normalizeAuthFlow(flow);
  try {
    if (PASSWORD_SETUP_FLOWS.has(normalized)) sessionStorage.setItem(AUTH_FLOW_STORAGE_KEY, normalized);
    else sessionStorage.removeItem(AUTH_FLOW_STORAGE_KEY);
  } catch {}
  return PASSWORD_SETUP_FLOWS.has(normalized) ? normalized : "";
}

function destinationForFlow(flow) {
  return PASSWORD_SETUP_FLOWS.has(normalizeAuthFlow(flow))
    ? ACCOUNT_DESTINATION_PATH
    : AUTH_DESTINATION_PATH;
}

export function getCurrentAuthFlow() {
  return normalizeAuthFlow(getAuthState().flow || readPersistedAuthFlow());
}

export function clearAuthFlow() {
  persistAuthFlow("");
  setAuthState({ flow: null });
}

export function prepareSignInWithProvider(provider, { flow = "" } = {}) {
  const normalized = normalizeOAuthProvider(provider);
  const authFlow = normalizeAuthFlow(flow);
  const cacheKey = normalized + ":" + authFlow;
  const existing = preparedOAuthRedirects.get(cacheKey);
  if (existing) return existing;

  const prepared = (async () => {
    const client = await withTimeout(getSupabaseClient(), "Supabase client");
    const options = {
      redirectTo: getAuthRedirectUrl(),
      skipBrowserRedirect: true,
    };
    if (authFlow) options.redirectTo = getAuthRedirectUrl(authFlow);
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
    preparedOAuthRedirects.delete(cacheKey);
    throw error;
  });

  preparedOAuthRedirects.set(cacheKey, prepared);
  return prepared;
}

function applySession(session, error = null, flow = getCurrentAuthFlow()) {
  const normalizedFlow = PASSWORD_SETUP_FLOWS.has(normalizeAuthFlow(flow))
    ? normalizeAuthFlow(flow)
    : "";
  return setAuthState({
    ready: true,
    session: session || null,
    user: session?.user || null,
    error,
    flow: normalizedFlow || null,
  });
}

function bindAuthEvents(client) {
  if (authSubscription) return;
  const { data } = client.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      persistAuthFlow("recovery");
      applySession(session, null, "recovery");
      return;
    }
    if (event === "SIGNED_OUT") {
      persistAuthFlow("");
      applySession(null, null, "");
      return;
    }
    applySession(session, null, getCurrentAuthFlow());
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
    flow: normalizeAuthFlow(read(AUTH_FLOW_KEY)),
    present: CALLBACK_KEYS.some((key) => query.has(key) || hash.has(key)),
  };
}

function clearCallbackUrl(flow = "") {
  const url = new URL(window.location.href);
  [...CALLBACK_KEYS, AUTH_FLOW_KEY].forEach((key) => url.searchParams.delete(key));
  const rawHash = String(url.hash || "");
  const hashParams = new URLSearchParams(rawHash.replace(/^#/, ""));
  const authHashPresent = [...CALLBACK_KEYS, AUTH_FLOW_KEY].some((key) => hashParams.has(key));
  if (authHashPresent) [...CALLBACK_KEYS, AUTH_FLOW_KEY].forEach((key) => hashParams.delete(key));
  const search = url.searchParams.toString();
  const hash = authHashPresent ? hashParams.toString() : rawHash.replace(/^#/, "");
  const destination = destinationForFlow(flow);
  window.history.replaceState(
    window.history.state,
    "",
    destination + (search ? "?" + search : "") + (hash ? "#" + hash : ""),
  );
}

function consumeAuthCallback(flow = callbackParams().flow) {
  preparedOAuthRedirects.clear();
  clearCallbackUrl(flow);
}

export function hasAuthCallback(locationObject = window.location) {
  const query = new URLSearchParams(locationObject.search || "");
  const hash = new URLSearchParams(String(locationObject.hash || "").replace(/^#/, ""));
  return CALLBACK_KEYS.some((key) => query.has(key) || hash.has(key));
}

async function handleAuthCallback(client) {
  const callback = callbackParams();
  if (!callback.present) return false;
  const postFlow = PASSWORD_SETUP_FLOWS.has(callback.flow) ? callback.flow : "";
  persistAuthFlow(postFlow);
  setAuthState({ error: null, flow: postFlow || null });

  try {
    if (callback.error) throw new Error(callback.error);
    if (!callback.code) throw new Error(msg("service.kod_avtorizatsii_otsutstvuet"));

    if (!callbackPromise) {
      callbackPromise = (async () => {
        const { data, error } = await withTimeout(
          client.auth.exchangeCodeForSession(callback.code),
          "Auth callback",
        );
        if (error) throw error;
        if (!data?.session?.user) throw new Error(msg("service.sessiya_ne_byla_sozdana"));
        bindAuthEvents(client);
        applySession(data.session, null, postFlow);
        return data.session;
      })().finally(() => {
        callbackPromise = null;
      });
    }

    await callbackPromise;
    return true;
  } catch (error) {
    persistAuthFlow("");
    applySession(null, callbackAuthMessage(error), "");
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
        persistAuthFlow("");
        return applySession(null, null, "");
      }

      const restoredFlow = callbackPresent ? "" : readPersistedAuthFlow();
      if (restoredFlow) setAuthState({ flow: restoredFlow });
      const client = await withTimeout(getSupabaseClient(), "Supabase client");
      const callbackHandled = await handleAuthCallback(client);
      if (!callbackHandled) {
        const { data, error } = await withTimeout(client.auth.getSession(), "Auth session");
        if (error) throw error;
        const session = data.session || null;
        if (!session) persistAuthFlow("");
        applySession(session, null, session ? restoredFlow : "");
      }
      bindAuthEvents(client);
    } catch (error) {
      if (callbackPresent) consumeAuthCallback();
      persistAuthFlow("");
      const current = getAuthState();
      setAuthState({
        ...current,
        ready: true,
        flow: null,
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
    persistAuthFlow("");
    setAuthState({ error: null, flow: null });
    const client = await withTimeout(getSupabaseClient(), "Supabase client");
    const { data, error } = await withTimeout(client.auth.signInWithIdToken({
      provider: "google",
      token: credential,
      nonce: rawNonce,
    }), "Google token sign in");
    if (error) throw error;
    if (!data?.session?.user) throw new Error(msg("service.sessiya_ne_byla_sozdana"));
    bindAuthEvents(client);
    applySession(data.session, null, "");
    return data;
  } catch (error) {
    throw new Error(authMessage(error));
  }
}

export async function signInWithProvider(provider, { flow = "" } = {}) {
  const normalized = normalizeOAuthProvider(provider);
  const authFlow = normalizeAuthFlow(flow);
  const postFlow = PASSWORD_SETUP_FLOWS.has(authFlow) ? authFlow : "";
  persistAuthFlow(postFlow);
  setAuthState({ error: null, flow: postFlow || null });

  try {
    const url = await prepareSignInWithProvider(normalized, { flow: authFlow });
    window.location.href = url;
    return { provider: normalized, url };
  } catch (error) {
    persistAuthFlow("");
    setAuthState({ flow: null });
    throw new Error(authMessage(error));
  }
}

export async function signInWithLegacyGoogle() {
  return signInWithProvider("google", { flow: "legacy_google" });
}

export async function signInWithEmail(email, password) {
  const normalizedEmail = validateEmail(email);
  const normalizedPassword = validatePassword(password);
  persistAuthFlow("");
  setAuthState({ error: null, flow: null });
  try {
    const client = await withTimeout(getSupabaseClient(), "Supabase client");
    const { data, error } = await withTimeout(
      client.auth.signInWithPassword({ email: normalizedEmail, password: normalizedPassword }),
      "Email sign in",
    );
    if (error) throw error;
    if (!data?.session?.user) throw new Error(msg("service.sessiya_ne_byla_sozdana"));
    bindAuthEvents(client);
    applySession(data.session, null, "");
    return data;
  } catch (error) {
    throw new Error(authMessage(error));
  }
}

export async function signUpWithEmail(email, password) {
  const normalizedEmail = validateEmail(email);
  const normalizedPassword = validatePassword(password);
  persistAuthFlow("");
  setAuthState({ error: null, flow: null });
  try {
    const client = await withTimeout(getSupabaseClient(), "Supabase client");
    bindAuthEvents(client);
    const { data, error } = await withTimeout(
      client.auth.signUp({
        email: normalizedEmail,
        password: normalizedPassword,
        options: { emailRedirectTo: getAuthRedirectUrl("signup") },
      }),
      "Email sign up",
    );
    if (error) throw error;
    if (data?.session?.user) applySession(data.session, null, "");
    return data;
  } catch (error) {
    throw new Error(authMessage(error, msg("account.ne_udalos_vypolnit_operatsiyu_povtorite_pozzhe")));
  }
}

export async function sendPasswordReset(email) {
  const normalizedEmail = validateEmail(email);
  try {
    const client = await withTimeout(getSupabaseClient(), "Supabase client");
    const { data, error } = await withTimeout(
      client.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: getAuthRedirectUrl("recovery"),
      }),
      "Password reset",
    );
    if (error) throw error;
    return data;
  } catch (error) {
    throw new Error(authMessage(error, msg("service.ne_udalos_otpravit_pismo")));
  }
}

export async function updateCurrentUserPassword(password) {
  const normalizedPassword = validatePassword(password);
  const flow = getCurrentAuthFlow();
  const originalUserId = String(getAuthState().user?.id || "");
  try {
    const client = await withTimeout(getSupabaseClient(), "Supabase client");
    const { data, error } = await withTimeout(
      client.auth.updateUser({ password: normalizedPassword }),
      "Password update",
    );
    if (error) throw error;
    const { data: sessionData, error: sessionError } = await withTimeout(
      client.auth.getSession(),
      "Auth session",
    );
    if (sessionError) throw sessionError;
    if (!sessionData?.session?.user) throw new Error(msg("service.sessiya_ne_byla_sozdana"));
    const updatedUserId = String(sessionData.session.user.id || "");
    if (flow === "legacy_google" && originalUserId && updatedUserId !== originalUserId) {
      throw new Error("Account identity changed during legacy Google migration");
    }
    persistAuthFlow("");
    applySession(sessionData.session, null, "");
    return data;
  } catch (error) {
    throw new Error(authMessage(error, msg("account.ne_udalos_vypolnit_operatsiyu_povtorite_pozzhe")));
  }
}

export async function signOut() {
  try {
    const client = await withTimeout(getSupabaseClient(), "Supabase client");
    const { error } = await withTimeout(client.auth.signOut({ scope: "local" }), "Sign out");
    if (error) throw error;
    persistAuthFlow("");
    applySession(null, null, "");
  } catch (error) {
    throw new Error(authMessage(error));
  }
}

export function getCurrentAuthState() { return getAuthState(); }
export function subscribeToAuth(subscriber) { return subscribeAuthState(subscriber); }
export function getUserProvider(user) {
  const providers = Array.isArray(user?.app_metadata?.providers)
    ? user.app_metadata.providers.map((value) => String(value || "").toLowerCase())
    : [];
  const provider = String(user?.app_metadata?.provider || "").toLowerCase();
  if (provider === "email" || providers.includes("email")) return "Email";
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

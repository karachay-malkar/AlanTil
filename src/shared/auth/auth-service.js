import { getAuthRedirectUrl } from "../../config/supabase.js?v=13.8";
import { getAuthState, setAuthState, subscribeAuthState } from "./auth-store.js?v=13.8";
import { getSupabaseClient } from "./supabase-client.js?v=13.8";

const AUTH_CALLBACK_PARAMETERS = Object.freeze([
  "code",
  "error",
  "error_code",
  "error_description",
]);

let initializationPromise = null;
let authSubscription = null;
let callbackExchangeCode = "";
let callbackExchangePromise = null;
const successfulCallbackCodes = new Set();

function isRedirectConfigurationError(value) {
  return /(?:redirect(?:_to)?|redirect url|callback url|return url|requested path).*(?:not allowed|not permitted|invalid|allow list)|not in (?:the )?allow list/i.test(value);
}

function normalizeAuthError(error, fallback = "Не удалось выполнить вход.") {
  const message = String(error?.message || error || "").trim();
  if (!message) return fallback;
  if (isRedirectConfigurationError(message)) {
    return "Ссылка возврата не разрешена в Supabase.";
  }
  if (/blocked|banned|signup.*disabled|регистрац/i.test(message)) {
    return "Вход или регистрация для этого адреса недоступны.";
  }
  if (/rate limit|too many requests/i.test(message)) {
    return "Слишком много попыток. Повторите позже.";
  }
  if (/network|fetch|failed to fetch|load failed/i.test(message)) {
    return "Не удалось связаться с сервисом авторизации.";
  }
  return fallback;
}

function normalizeCallbackError(error) {
  const message = String(error?.message || error || "").trim();
  if (isRedirectConfigurationError(message)) {
    return "Ссылка возврата не разрешена в Supabase.";
  }
  return "Не удалось завершить вход через Google.";
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
      ? "Ссылка возврата не разрешена в Supabase."
      : "Не удалось завершить вход через Google.";
    setAuthState({ ready: true, error: message });
    cleanAuthCallbackUrl({ removeCode: false });
    return { handled: true, success: false, error: message };
  }

  if (!callback.hasCode || !String(callback.code || "").trim()) {
    const message = "Код авторизации отсутствует.";
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
      error: current.session && current.user ? null : "Сессия не была создана.",
    };
  }
  if (callbackExchangeCode === code && callbackExchangePromise) return callbackExchangePromise;

  callbackExchangeCode = code;
  callbackExchangePromise = (async () => {
    try {
      const client = clientOverride || await getSupabaseClient();
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (error) throw error;

      const session = data?.session || null;
      const user = data?.user || session?.user || null;
      if (!session || !user) {
        const message = "Сессия не была создана.";
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

export async function initializeAuth() {
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    try {
      const client = await getSupabaseClient();
      const callbackResult = await handleAuthCallback(client);

      if (!callbackResult.handled || !callbackResult.success) {
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        setSessionState(data.session || null, callbackResult.handled ? callbackResult.error || null : null);
      }

      ensureAuthSubscription(client);
      return getAuthState();
    } catch (error) {
      const current = getAuthState();
      const message = hasAuthCallback()
        ? normalizeCallbackError(error)
        : normalizeAuthError(error, "Не удалось проверить состояние аккаунта.");
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

export async function signInWithGoogle() {
  setAuthState({ error: null });
  const client = await getSupabaseClient();
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: getAuthRedirectUrl(),
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw new Error(normalizeAuthError(error));
  return data;
}

export async function signInWithEmail(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) throw new Error("Введите электронную почту.");

  setAuthState({ error: null });
  const client = await getSupabaseClient();
  const { data, error } = await client.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      emailRedirectTo: getAuthRedirectUrl(),
      shouldCreateUser: true,
    },
  });
  if (error) throw new Error(normalizeAuthError(error));
  return data;
}

export async function signOut() {
  setAuthState({ error: null });
  const client = await getSupabaseClient();
  const { error } = await client.auth.signOut({ scope: "local" });
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
  if (provider === "email") return "Email";
  return provider || "Не определён";
}

export function disposeAuth() {
  authSubscription?.unsubscribe?.();
  authSubscription = null;
  initializationPromise = null;
  callbackExchangeCode = "";
  callbackExchangePromise = null;
  successfulCallbackCodes.clear();
}

import { getAuthRedirectUrl } from "../../config/supabase.js";
import { getAuthState, setAuthState, subscribeAuthState } from "./auth-store.js";
import { getSupabaseClient } from "./supabase-client.js";

let initializationPromise = null;
let authSubscription = null;

function normalizeAuthError(error) {
  const message = String(error?.message || "").trim();
  if (!message) return "Не удалось выполнить вход.";
  if (/blocked|banned|not allowed|signup.*disabled|регистрац/i.test(message)) {
    return "Вход или регистрация для этого адреса недоступны.";
  }
  if (/rate limit|too many requests/i.test(message)) {
    return "Слишком много попыток. Повторите позже.";
  }
  return message;
}

export async function initializeAuth() {
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    try {
      const client = await getSupabaseClient();
      const { data, error } = await client.auth.getSession();
      if (error) throw error;

      setAuthState({
        ready: true,
        session: data.session || null,
        user: data.session?.user || null,
        error: null,
      });

      const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
        setAuthState({
          ready: true,
          session: session || null,
          user: session?.user || null,
          error: null,
        });
      });
      authSubscription = listener.subscription;
      return getAuthState();
    } catch (error) {
      const normalized = normalizeAuthError(error);
      setAuthState({ ready: true, session: null, user: null, error: normalized });
      throw new Error(normalized);
    }
  })();

  return initializationPromise;
}

export async function signInWithGoogle() {
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
  const client = await getSupabaseClient();
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) throw new Error(normalizeAuthError(error));
  setAuthState({ ready: true, session: null, user: null, error: null });
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
}

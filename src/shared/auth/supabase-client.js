import { supabasePublishableKey, supabaseUrl } from "../../config/supabase.js?v=13.10.6";

const PRIMARY_MODULE_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.7/+esm";
const LOCAL_FALLBACK_MODULE_URL = "/src/vendor/supabase-js.js?v=13.10.2";
const FALLBACK_DELAY_MS = 800;
export const AUTH_STORAGE_KEY = "alantil_auth_session_v1";
let modulePromise = null;
let clientPromise = null;

function delayedImport(url, delayMs) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, delayMs)).then(() => import(url));
}

function firstSuccessful(promises) {
  return new Promise((resolve, reject) => {
    const errors = [];
    let remaining = promises.length;
    promises.forEach((promise, index) => {
      Promise.resolve(promise).then(resolve).catch((error) => {
        errors[index] = error;
        remaining -= 1;
        if (!remaining) reject(new AggregateError(errors, "Supabase SDK could not be loaded"));
      });
    });
  });
}

function loadSupabaseModule() {
  if (!modulePromise) {
    modulePromise = firstSuccessful([
      import(PRIMARY_MODULE_URL),
      delayedImport(LOCAL_FALLBACK_MODULE_URL, FALLBACK_DELAY_MS),
    ]).catch((error) => {
      modulePromise = null;
      throw error;
    });
  }
  return modulePromise;
}

export function hasPersistedAuthSession() {
  try {
    return Boolean(localStorage.getItem(AUTH_STORAGE_KEY));
  } catch {
    return false;
  }
}

export function getSupabaseClient() {
  if (!clientPromise) {
    clientPromise = loadSupabaseModule()
      .then(({ createClient }) => createClient(supabaseUrl, supabasePublishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: "pkce",
          storageKey: AUTH_STORAGE_KEY,
        },
      }))
      .catch((error) => {
        clientPromise = null;
        throw error;
      });
  }
  return clientPromise;
}

export function preloadSupabaseClient() {
  return getSupabaseClient().then(() => true).catch(() => false);
}

import { supabasePublishableKey, supabaseUrl } from "../../config/supabase.js?v=13.9.0";

const SUPABASE_MODULE_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const AUTH_STORAGE_KEY = "alantil_auth_session_v1";
const MODULE_TIMEOUT_MS = 5000;

let clientPromise = null;

function importWithTimeout(url, timeoutMs) {
  let timer = 0;
  return Promise.race([
    import(url),
    new Promise((_, reject) => {
      timer = globalThis.setTimeout(() => {
        const error = new Error(`Supabase module timeout after ${timeoutMs} ms`);
        error.code = "ALANTIL_TIMEOUT";
        reject(error);
      }, timeoutMs);
    }),
  ]).finally(() => globalThis.clearTimeout(timer));
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
    clientPromise = importWithTimeout(SUPABASE_MODULE_URL, MODULE_TIMEOUT_MS)
      .then(({ createClient }) => createClient(
        supabaseUrl,
        supabasePublishableKey,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
            flowType: "pkce",
            storageKey: AUTH_STORAGE_KEY,
          },
        },
      ))
      .catch((error) => {
        clientPromise = null;
        throw error;
      });
  }
  return clientPromise;
}

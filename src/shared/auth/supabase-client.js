import { supabasePublishableKey, supabaseUrl } from "../../config/supabase.js?v=13.10.2";

const SUPABASE_MODULE_URL = "/src/vendor/supabase-js.js?v=13.10.2";
const AUTH_STORAGE_KEY = "alantil_auth_session_v1";
let clientPromise = null;

export function hasPersistedAuthSession() {
  try {
    return Boolean(localStorage.getItem(AUTH_STORAGE_KEY));
  } catch {
    return false;
  }
}

export function getSupabaseClient() {
  if (!clientPromise) {
    clientPromise = import(SUPABASE_MODULE_URL)
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

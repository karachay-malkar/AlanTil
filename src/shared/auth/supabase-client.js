import { supabasePublishableKey, supabaseUrl } from "../../config/supabase.js?v=13.10.5";

const SUPABASE_MODULE_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.7/+esm";
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

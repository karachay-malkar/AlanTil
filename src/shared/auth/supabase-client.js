import { supabasePublishableKey, supabaseUrl } from "../../config/supabase.js?v=13.10.6";

const LOCAL_MODULE_URL = "/src/vendor/supabase-js.js?v=16.7.0-oauth1";
const CDN_MODULE_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.7/+esm";
export const AUTH_STORAGE_KEY = "alantil_auth_session_v1";
let modulePromise = null;
let clientPromise = null;

function loadSupabaseModule() {
  if (!modulePromise) {
    modulePromise = import(LOCAL_MODULE_URL)
      .catch(async (localError) => {
        try {
          return await import(CDN_MODULE_URL);
        } catch (cdnError) {
          throw new AggregateError([localError, cdnError], "Supabase SDK could not be loaded");
        }
      })
      .then((module) => {
        if (typeof module?.createClient !== "function") throw new Error("Supabase SDK is invalid");
        return module;
      })
      .catch((error) => {
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

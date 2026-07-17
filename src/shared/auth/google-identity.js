import {
  googleClientIdEndpoint,
  supabasePublishableKey,
} from "../../config/supabase.js?v=13.10.1";
import { msg } from "../i18n/index.js?v=13.10.1";

const GOOGLE_SCRIPT_ID = "alantil-google-identity";
const GOOGLE_SCRIPT_URL = "https://accounts.google.com/gsi/client";
const CLIENT_ID_CACHE_KEY = "alantil_google_client_id_v1";
const REQUEST_TIMEOUT_MS = 7000;

let scriptPromise = null;
let clientIdPromise = null;

function timeoutError(label) {
  const error = new Error(`${label} timeout`);
  error.code = "ALANTIL_TIMEOUT";
  return error;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") throw timeoutError("Google configuration");
    throw error;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

function readCachedClientId() {
  try {
    const value = String(localStorage.getItem(CLIENT_ID_CACHE_KEY) || "").trim();
    return value.endsWith(".apps.googleusercontent.com") ? value : "";
  } catch {
    return "";
  }
}

function cacheClientId(value) {
  try {
    localStorage.setItem(CLIENT_ID_CACHE_KEY, value);
  } catch {
    // Restricted storage does not prevent Google sign-in.
  }
}

async function getGoogleClientId() {
  const cached = readCachedClientId();
  if (cached) return cached;
  if (clientIdPromise) return clientIdPromise;

  clientIdPromise = (async () => {
    const response = await fetchWithTimeout(googleClientIdEndpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
        apikey: supabasePublishableKey,
      },
    });
    if (!response.ok) throw new Error(`Google configuration failed: ${response.status}`);
    const payload = await response.json();
    const clientId = String(payload?.client_id || "").trim();
    if (!clientId.endsWith(".apps.googleusercontent.com")) {
      throw new Error("Google client ID is unavailable");
    }
    cacheClientId(clientId);
    return clientId;
  })().catch((error) => {
    clientIdPromise = null;
    throw error;
  });

  return clientIdPromise;
}

function loadGoogleScript() {
  if (globalThis.google?.accounts?.id) return Promise.resolve(globalThis.google);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_SCRIPT_ID);
    const script = existing || document.createElement("script");
    let timer = 0;

    const finish = (callback, value) => {
      globalThis.clearTimeout(timer);
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
      callback(value);
    };
    const onLoad = () => {
      if (globalThis.google?.accounts?.id) finish(resolve, globalThis.google);
      else finish(reject, new Error("Google Identity Services did not initialize"));
    };
    const onError = () => finish(reject, new Error("Google Identity Services could not be loaded"));

    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    timer = globalThis.setTimeout(() => finish(reject, timeoutError("Google Identity Services")), REQUEST_TIMEOUT_MS);

    if (!existing) {
      script.id = GOOGLE_SCRIPT_ID;
      script.src = GOOGLE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.referrerPolicy = "strict-origin-when-cross-origin";
      document.head.appendChild(script);
    }
  }).catch((error) => {
    scriptPromise = null;
    throw error;
  });

  return scriptPromise;
}

function randomNonce() {
  const values = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("");
}

async function hashNonce(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (item) => item.toString(16).padStart(2, "0")).join("");
}

export async function renderGoogleIdentityButton(container, {
  onCredential,
  onError,
} = {}) {
  if (!container) return false;

  container.replaceChildren();
  container.setAttribute("aria-busy", "true");

  try {
    const [googleApi, clientId] = await Promise.all([
      loadGoogleScript(),
      getGoogleClientId(),
    ]);
    if (!container.isConnected) return false;

    const nonce = randomNonce();
    const hashedNonce = await hashNonce(nonce);
    googleApi.accounts.id.initialize({
      client_id: clientId,
      nonce: hashedNonce,
      auto_select: false,
      cancel_on_tap_outside: false,
      use_fedcm_for_prompt: true,
      callback: async (response) => {
        const credential = String(response?.credential || "").trim();
        if (!credential) {
          onError?.(new Error("Google did not return an identity token"));
          return;
        }
        try {
          await onCredential?.({ credential, nonce });
        } catch (error) {
          onError?.(error);
        }
      },
    });

    googleApi.accounts.id.renderButton(container, {
      type: "standard",
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "signin_with",
      logo_alignment: "left",
      width: Math.max(240, Math.min(360, Math.round(container.getBoundingClientRect().width || 320))),
    });
    container.setAttribute("aria-busy", "false");
    return true;
  } catch (error) {
    container.setAttribute("aria-busy", "false");
    container.textContent = msg("account.vhod_cherez_google_vremenno_nedostupen");
    onError?.(error);
    return false;
  }
}

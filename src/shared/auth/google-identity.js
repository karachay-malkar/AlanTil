import {
  GOOGLE_IDENTITY_SCRIPT_URL,
  GOOGLE_WEB_CLIENT_ID,
} from "../../config/auth.js?v=13.10.2";
import { msg } from "../i18n/index.js?v=13.10.2";

const GOOGLE_SCRIPT_ID = "alantil-google-identity";
const LOAD_TIMEOUT_MS = 30000;
const RETRY_DELAYS_MS = Object.freeze([1500, 5000, 15000, 30000]);
let scriptPromise = null;
let onlineBound = false;
const activeRenderers = new Set();

function timeoutError() {
  const error = new Error("Google Identity Services timeout");
  error.code = "ALANTIL_TIMEOUT";
  return error;
}

function currentGoogleApi() {
  return globalThis.google?.accounts?.id ? globalThis.google : null;
}

function loadGoogleScriptOnce() {
  const ready = currentGoogleApi();
  if (ready) return Promise.resolve(ready);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    let script = document.getElementById(GOOGLE_SCRIPT_ID);
    if (script?.dataset.loadState === "error") {
      script.remove();
      script = null;
    }
    script ||= document.createElement("script");
    let timer = 0;

    const cleanup = () => {
      globalThis.clearTimeout(timer);
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    };
    const fail = (error) => {
      cleanup();
      script.dataset.loadState = "error";
      script.remove();
      reject(error);
    };
    const onLoad = () => {
      cleanup();
      const api = currentGoogleApi();
      if (!api) {
        fail(new Error("Google Identity Services did not initialize"));
        return;
      }
      script.dataset.loadState = "ready";
      resolve(api);
    };
    const onError = () => fail(new Error("Google Identity Services could not be loaded"));

    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    timer = globalThis.setTimeout(() => fail(timeoutError()), LOAD_TIMEOUT_MS);

    if (!script.id) {
      script.id = GOOGLE_SCRIPT_ID;
      script.src = GOOGLE_IDENTITY_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.referrerPolicy = "strict-origin-when-cross-origin";
      script.dataset.loadState = "loading";
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

function bindOnlineRetry() {
  if (onlineBound || !globalThis.addEventListener) return;
  onlineBound = true;
  globalThis.addEventListener("online", () => {
    activeRenderers.forEach((retry) => retry({ automatic: true, immediate: true }));
  });
}

export async function preloadGoogleIdentity() {
  try {
    return await loadGoogleScriptOnce();
  } catch (error) {
    console.warn("Google Identity preload failed", error);
    return null;
  }
}

export function renderGoogleIdentityButton(container, {
  onCredential,
  onError,
} = {}) {
  if (!container) return () => {};
  bindOnlineRetry();

  const fallbackButton = container.querySelector("[data-google-fallback]");
  const officialSlot = container.querySelector("[data-google-official]");
  const status = container.querySelector("[data-google-status]");
  let disposed = false;
  let loading = false;
  let initialized = false;
  let retryIndex = 0;
  let retryTimer = 0;

  const clearRetryTimer = () => {
    if (retryTimer) globalThis.clearTimeout(retryTimer);
    retryTimer = 0;
  };

  const setState = (state, text = "") => {
    if (disposed || !container.isConnected) return;
    container.dataset.googleState = state;
    container.setAttribute("aria-busy", ["loading", "signing-in"].includes(state) ? "true" : "false");
    if (status) status.textContent = text;
    if (fallbackButton) fallbackButton.disabled = state === "signing-in";
  };

  const initializeOfficialButton = async (googleApi) => {
    if (disposed || initialized || !officialSlot?.isConnected) return initialized;
    const nonce = randomNonce();
    const hashedNonce = await hashNonce(nonce);
    googleApi.accounts.id.initialize({
      client_id: GOOGLE_WEB_CLIENT_ID,
      nonce: hashedNonce,
      auto_select: false,
      cancel_on_tap_outside: false,
      use_fedcm_for_prompt: true,
      callback: async (response) => {
        const credential = String(response?.credential || "").trim();
        if (!credential) {
          const error = new Error("Google did not return an identity token");
          setState("ready", msg("account.ne_udalos_podklyuchitsya_k_google"));
          onError?.(error);
          return;
        }
        try {
          setState("signing-in", msg("account.podtverzhdaem_vhod"));
          await onCredential?.({ credential, nonce });
        } catch (error) {
          setState("ready", msg("account.ne_udalos_podklyuchitsya_k_google"));
          onError?.(error);
        }
      },
    });
    officialSlot.replaceChildren();
    googleApi.accounts.id.renderButton(officialSlot, {
      type: "standard",
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "signin_with",
      logo_alignment: "left",
      width: Math.max(240, Math.min(360, Math.round(container.getBoundingClientRect().width || 320))),
    });
    initialized = Boolean(officialSlot.childElementCount);
    if (!initialized) throw new Error("Google button was not rendered");
    retryIndex = 0;
    clearRetryTimer();
    setState("ready", "");
    return true;
  };

  const scheduleAutomaticRetry = () => {
    if (disposed || initialized || retryTimer) return;
    const delay = RETRY_DELAYS_MS[Math.min(retryIndex, RETRY_DELAYS_MS.length - 1)];
    retryIndex += 1;
    retryTimer = globalThis.setTimeout(() => {
      retryTimer = 0;
      void retry({ automatic: true });
    }, delay);
  };

  const retry = async ({ automatic = false, immediate = false } = {}) => {
    if (!container.isConnected) {
      disposed = true;
      activeRenderers.delete(retry);
      clearRetryTimer();
      return false;
    }
    if (disposed || loading || initialized) return initialized;
    if (immediate) clearRetryTimer();
    if (globalThis.navigator && navigator.onLine === false) {
      setState("retry", msg("account.ne_udalos_podklyuchitsya_k_google"));
      scheduleAutomaticRetry();
      return false;
    }

    loading = true;
    setState("loading", automatic ? "" : msg("account.podklyuchaem_google"));
    try {
      return await initializeOfficialButton(await loadGoogleScriptOnce());
    } catch (error) {
      setState("retry", msg("account.ne_udalos_podklyuchitsya_k_google"));
      scheduleAutomaticRetry();
      console.warn("Google Identity initialization failed", error);
      return false;
    } finally {
      loading = false;
    }
  };

  fallbackButton?.addEventListener("click", () => retry({ immediate: true }));
  activeRenderers.add(retry);
  void retry({ automatic: true, immediate: true });

  return () => {
    disposed = true;
    clearRetryTimer();
    activeRenderers.delete(retry);
  };
}

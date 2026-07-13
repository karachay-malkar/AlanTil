const TELEGRAM_SCRIPT_ID = "telegram-web-app-script";
const TELEGRAM_SCRIPT_SRC = "https://telegram.org/js/telegram-web-app.js?62";
const TELEGRAM_SCRIPT_TIMEOUT_MS = 8000;
const TELEGRAM_LAUNCH_PARAMETERS = Object.freeze([
  "tgWebAppData",
  "tgWebAppVersion",
  "tgWebAppPlatform",
  "tgWebAppThemeParams",
]);

function readLaunchParameters(locationObject = window.location) {
  const parameters = new URLSearchParams(locationObject.search || "");
  const hash = String(locationObject.hash || "").replace(/^#/, "");
  const hashParameters = new URLSearchParams(hash);
  hashParameters.forEach((value, key) => parameters.set(key, value));
  return parameters;
}

export function isTelegramMiniAppLaunch(locationObject = window.location) {
  if (window.Telegram?.WebApp) return true;
  const parameters = readLaunchParameters(locationObject);
  return TELEGRAM_LAUNCH_PARAMETERS.some((name) => parameters.has(name));
}

export function createTelegramAdapter(locationObject = window.location) {
  let webApp = null;
  const miniAppLaunch = isTelegramMiniAppLaunch(locationObject);
  const launchUrlSuffix = miniAppLaunch
    ? `${locationObject.search || ""}${locationObject.hash || ""}`
    : "";
  let preserveLaunchUrl = Boolean(launchUrlSuffix);

  return {
    attach(nextWebApp) {
      webApp = nextWebApp || null;
      return webApp;
    },

    getWebApp() {
      return webApp;
    },

    isMiniAppLaunch() {
      return miniAppLaunch;
    },

    getPendingUrlSuffix() {
      return preserveLaunchUrl ? launchUrlSuffix : "";
    },

    releaseLaunchUrl() {
      preserveLaunchUrl = false;
    },

    showAlert(message, callback) {
      if (typeof webApp?.showAlert === "function") {
        return webApp.showAlert(String(message || ""), callback);
      }
      window.alert(String(message || ""));
      callback?.();
      return undefined;
    },
  };
}

function loadTelegramScript() {
  if (window.Telegram?.WebApp) return Promise.resolve(window.Telegram.WebApp);

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(TELEGRAM_SCRIPT_ID);
    const script = existing || document.createElement("script");
    let settled = false;

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
      callback(value);
    };
    const handleLoad = () => finish(resolve, window.Telegram?.WebApp || null);
    const handleError = () => finish(reject, new Error("Telegram WebApp script failed to load"));
    const timeoutId = window.setTimeout(() => {
      finish(reject, new Error("Telegram WebApp script loading timed out"));
    }, TELEGRAM_SCRIPT_TIMEOUT_MS);

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });

    if (!existing) {
      script.id = TELEGRAM_SCRIPT_ID;
      script.src = TELEGRAM_SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

export async function initTelegram({ adapter, onReady } = {}) {
  const shouldLoad = adapter?.isMiniAppLaunch?.() || isTelegramMiniAppLaunch();
  if (!shouldLoad) return null;

  const webApp = await loadTelegramScript();
  if (!webApp) throw new Error("Telegram WebApp API is unavailable after script load");

  try {
    webApp.ready?.();
  } catch (error) {
    console.warn("Telegram WebApp ready() failed", error);
  }

  onReady?.(webApp);
  return webApp;
}

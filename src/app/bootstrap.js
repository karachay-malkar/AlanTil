import { prepareAnalytics } from "../shared/analytics/analytics.js?v=13.9.0";
import {
  getCurrentAuthState,
  hasAuthCallback,
  subscribeToAuth,
  waitForAuthInitialization,
} from "../shared/auth/auth-service.js?v=13.10.2";
import { initGuestProfilePrompt } from "../shared/auth/guest-profile-prompt.js?v=13.10.2";
import { preloadGoogleIdentity } from "../shared/auth/google-identity.js?v=13.10.2";
import { initializeProgressSystem, pullCloudProgress } from "../shared/progress/progress-sync.js?v=13.10.2";
import { initializeI18n, msg } from "../shared/i18n/index.js?v=13.10.2";
import { createTelegramAdapter, initTelegram } from "../shared/platform/telegram.js?v=13.9.0";
import { initPrivacyController } from "../shared/privacy/privacy-controller.js?v=13.9.0";
import { createModalService } from "../shared/ui/modal.js?v=13.9.0";
import { createRouter } from "./router.js?v=13.10.2";
import { createShell } from "./shell.js?v=13.9.0";

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js?v=13.10.2", { scope: "/" })
      .catch((error) => console.warn("Service worker registration failed", error));
  }, { once: true });
}

async function bootstrap() {
  initializeI18n();
  prepareAnalytics();
  registerServiceWorker();
  const callbackVisit = hasAuthCallback() || window.location.pathname === "/auth/callback";
  const telegram = createTelegramAdapter();
  const shell = createShell();
  const modal = createModalService(shell.modalRoot);
  const context = {
    root: shell.root,
    shell,
    modal,
    telegram,
    ensureStyle() {
      // Feature styles are loaded once through app.css.
    },
  };

  shell.renderHome();
  void preloadGoogleIdentity();
  await initializeProgressSystem();
  const authReady = waitForAuthInitialization();
  if (callbackVisit) await authReady;

  const router = createRouter({ shell, modal, context });
  let dictionaryRefreshQueued = false;
  const refreshDictionaryScreen = () => {
    if (dictionaryRefreshQueued) return;
    dictionaryRefreshQueued = true;
    globalThis.setTimeout(async () => {
      dictionaryRefreshQueued = false;
      const route = router.getCurrent().route;
      if (!route.startsWith("path.") && !route.startsWith("learn.")) return;
      const refreshed = await router.refresh();
      if (!refreshed) refreshDictionaryScreen();
    }, 100);
  };
  window.addEventListener("alantil:dictionary-updated", refreshDictionaryScreen);

  await router.start();
  void initPrivacyController({ appRouter: router });
  if (!callbackVisit) initGuestProfilePrompt({ modal, router });

  let activeUserId = getCurrentAuthState().user?.id || "";
  subscribeToAuth((state) => {
    if (!state.ready) return;
    const nextUserId = state.user?.id || "";
    if (nextUserId === activeUserId) return;
    activeUserId = nextUserId;
    if (!nextUserId) {
      void router.refresh();
      return;
    }
    void pullCloudProgress().finally(() => router.refresh());
  });

  void authReady.then(async () => {
    if (callbackVisit) await router.replace("account.home", {}, { force: true });
  }).catch((error) => console.warn("Authentication initialization failed", error));

  void initTelegram({
    adapter: telegram,
    onReady(webApp) { router.attachTelegram(webApp); },
  }).catch((error) => {
    router.releaseTelegramLaunchUrl();
    console.warn("Telegram WebApp initialization failed", error);
  });
}

bootstrap().catch((error) => {
  console.error("Application bootstrap failed", error);
  const shell = document.getElementById("appRoot");
  if (shell) shell.innerHTML = `<section class="screenState screenStateError">${msg("common.ne_udalos_zapustit_prilozhenie")}</section>`;
});

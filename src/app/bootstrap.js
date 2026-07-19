import { prepareAnalytics } from "../shared/analytics/analytics.js?v=13.9.0";
import { hasAuthCallback, waitForAuthInitialization } from "../shared/auth/auth-service.js?v=13.10.12";
import { initGuestProfilePrompt } from "../shared/auth/guest-profile-prompt.js?v=13.10.12";
import { initializeProgressSystem } from "../shared/progress/progress-sync.js?v=13.10.12";
import { initializeI18n, msg } from "../shared/i18n/index.js?v=13.10.12";
import { createTelegramAdapter, initTelegram } from "../shared/platform/telegram.js?v=13.9.0";
import { initPrivacyController } from "../shared/privacy/privacy-controller.js?v=13.9.0";
import { createModalService } from "../shared/ui/modal.js?v=13.9.0";
import { runLearningSetup } from "../features/onboarding/index.js?v=13.10.12";
import { createRouter } from "./router.js?v=13.10.12";
import { createShell } from "./shell.js?v=13.9.0";

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js?v=13.10.12", { scope: "/" })
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

  // Resolve the saved account before rendering settings-dependent screens. A
  // guest resolves locally without loading the Supabase SDK.
  const authState = await waitForAuthInitialization();
  await initializeProgressSystem();

  // The learning language must be understandable before any sign-in screen is shown.
  if (!callbackVisit && !authState.user) {
    const setupWasShown = await runLearningSetup({ shell });
    if (setupWasShown) {
      window.history.replaceState(null, "", "/profile/account");
    }
  }

  shell.renderHome();

  const router = createRouter({ shell, modal, context });
  let dictionaryRefreshQueued = false;
  const refreshDictionaryScreen = () => {
    if (dictionaryRefreshQueued) return;
    dictionaryRefreshQueued = true;
    globalThis.setTimeout(async () => {
      dictionaryRefreshQueued = false;
      const route = router.getCurrent().route;
      if (!route.startsWith("path.") && !route.startsWith("learn.")) return;
      await router.refresh({ background: true, reason: "dictionary_update" });
    }, 100);
  };
  window.addEventListener("alantil:dictionary-updated", refreshDictionaryScreen);
  window.addEventListener("alantil:scope-ready", () => {
    void router.refresh({ background: true, reason: "storage_scope" });
  });

  await router.start();
  void initPrivacyController({ appRouter: router });
  if (!callbackVisit) initGuestProfilePrompt({ modal, router });

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

import { prepareAnalytics } from "../shared/analytics/analytics.js?v=13.9.0";
import {
  getCurrentAuthState,
  hasAuthCallback,
  subscribeToAuth,
  waitForAuthInitialization,
} from "../shared/auth/auth-service.js?v=13.10.1";
import { initGuestProfilePrompt } from "../shared/auth/guest-profile-prompt.js?v=13.10.1";
import {
  initializeProgressSystem,
  pullCloudProgress,
} from "../shared/progress/progress-sync.js?v=13.10.1";
import { initializeI18n, msg } from "../shared/i18n/index.js?v=13.10.1";
import { createTelegramAdapter, initTelegram } from "../shared/platform/telegram.js?v=13.9.0";
import { initPrivacyController } from "../shared/privacy/privacy-controller.js?v=13.9.0";
import { createModalService } from "../shared/ui/modal.js?v=13.9.0";
import { createRouter } from "./router.js?v=13.10.1";
import { createShell } from "./shell.js?v=13.9.0";

async function bootstrap() {
  initializeI18n();
  prepareAnalytics();
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

  // Local guest state is initialized before all network operations.
  await initializeProgressSystem();
  const authReady = waitForAuthInitialization();
  if (callbackVisit) await authReady;

  const router = createRouter({ shell, modal, context });
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
    if (callbackVisit) {
      await router.replace("account.home", {}, { force: true });
    }
  }).catch((error) => {
    console.warn("Authentication initialization failed", error);
  });

  void initTelegram({
    adapter: telegram,
    onReady(webApp) {
      router.attachTelegram(webApp);
    },
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

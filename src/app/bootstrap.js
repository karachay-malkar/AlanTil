import { prepareAnalytics } from "../shared/analytics/analytics.js?v=13.9.0";
import { initializeAuth } from "../shared/auth/auth-service.js?v=13.9.0";
import { initializeProgressSystem } from "../shared/progress/progress-sync.js?v=13.9.0";
import { initializeI18n, msg } from "../shared/i18n/index.js?v=13.9.0";
import { createTelegramAdapter, initTelegram } from "../shared/platform/telegram.js?v=13.9.0";
import { initPrivacyController } from "../shared/privacy/privacy-controller.js?v=13.9.0";
import { createModalService } from "../shared/ui/modal.js?v=13.9.0";
import { createRouter } from "./router.js?v=13.9.0";
import { createShell } from "./shell.js?v=13.9.0";

async function bootstrap() {
  initializeI18n();
  prepareAnalytics();
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
  await initializeAuth();
  await initializeProgressSystem();

  const router = createRouter({ shell, modal, context });
  await router.start();
  void initPrivacyController({ appRouter: router });

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

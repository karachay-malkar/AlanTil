import { prepareAnalytics } from "../shared/analytics/analytics.js";
import { initializeAuth } from "../shared/auth/auth-service.js?v=13.7.6";
import { initializeProgressSystem } from "../shared/progress/progress-sync.js?v=13.7.6";
import { createTelegramAdapter, initTelegram } from "../shared/platform/telegram.js";
import { initPrivacyController } from "../shared/privacy/privacy-controller.js";
import { createModalService } from "../shared/ui/modal.js";
import { createRouter } from "./router.js?v=13.7.6";
import { createShell } from "./shell.js?v=13.7.6";

async function bootstrap() {
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
  if (shell) shell.innerHTML = `<section class="screenState screenStateError">Не удалось запустить приложение.</section>`;
});

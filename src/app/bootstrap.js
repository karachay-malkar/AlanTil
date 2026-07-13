import { prepareAnalytics } from "../shared/analytics/analytics.js";
import { createTelegramAdapter, initTelegram } from "../shared/platform/telegram.js";
import { initPrivacyController } from "../shared/privacy/privacy-controller.js";
import { createModalService } from "../shared/ui/modal.js";
import { createRouter } from "./router.js?v=11.8.1";
import { createShell } from "./shell.js";

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
    ensureStyle(href, id) {
      if (document.getElementById(id)) return;
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    },
  };

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
  const root = document.getElementById("appRoot");
  if (root) root.innerHTML = `<section class="view screen"><div class="panel"><div class="errorState">Не удалось запустить приложение.</div></div></section>`;
});

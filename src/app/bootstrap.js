import { initAnalytics, trackEvent } from "../shared/analytics/analytics.js";
import { EVENTS } from "../shared/analytics/events.js";
import { createTelegramAdapter, initTelegram } from "../shared/platform/telegram.js";
import { createModalService } from "../shared/ui/modal.js";
import { createRouter } from "./router.js";
import { createShell } from "./shell.js";

async function bootstrap() {
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
  void initAnalytics();
  await router.start();
  trackEvent(EVENTS.APP_OPEN, { screen_name: router.getCurrent().route === "home" ? "home" : router.getCurrent().route.split(".")[0] });

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

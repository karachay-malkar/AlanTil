import { createModalService } from "../shared/ui/modal.js";
import { createRouter } from "./router.js";
import { createShell } from "./shell.js";

const telegram = window.Telegram?.WebApp;
try {
  telegram?.ready();
} catch (error) {
  console.warn("Telegram WebApp initialization failed", error);
}

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
shell.renderHome();
shell.setBackVisible(false);

window.addEventListener("popstate", () => router.back());

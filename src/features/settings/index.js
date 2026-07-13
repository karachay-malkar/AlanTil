import { renderSectionMenu } from "../../shared/ui/list.js";
import { panel } from "../../shared/ui/panel.js";
import { renderPrivacy } from "./privacy.js";
import { renderVersion } from "./version.js";

let controller = null;

function renderSettingsHome(context, signal) {
  context.root.innerHTML = panel({
    title: "Настройки",
    body: renderSectionMenu([
      { id: "settings.privacy", title: "Политика конфиденциальности" },
      { id: "settings.version", title: "Версия приложения" },
    ], { dataName: "settings-route" }),
  });

  context.root.querySelectorAll("[data-settings-route]").forEach((button) => {
    button.addEventListener("click", () => context.router.navigate(button.dataset.settingsRoute), { signal });
  });
}

export async function mount(context, params = {}) {
  controller = new AbortController();
  const screen = params.screen || "home";
  if (screen === "home") renderSettingsHome(context, controller.signal);
  else if (screen === "privacy") renderPrivacy(context);
  else if (screen === "version") renderVersion(context);
  else context.router.replace("settings.home", {}, { force: true });
}

export function unmount() {
  controller?.abort();
  controller = null;
}

export function canLeave() {
  return true;
}

import { renderSectionMenu } from "../../shared/ui/list.js";
import { panel } from "../../shared/ui/panel.js";

const SETTINGS_ASSET_VERSION = "12.3";
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

async function importSettingsScreen(path) {
  try {
    return await import(`${path}?v=${SETTINGS_ASSET_VERSION}`);
  } catch {
    return import(`${path}?v=${SETTINGS_ASSET_VERSION}&retry=${Date.now()}`);
  }
}

export async function mount(context, params = {}) {
  controller = new AbortController();
  const screen = params.screen || "home";

  if (screen === "home") {
    renderSettingsHome(context, controller.signal);
    return;
  }

  if (screen === "privacy") {
    const { renderPrivacy } = await importSettingsScreen("./privacy.js");
    renderPrivacy(context, controller.signal, params);
    return;
  }

  if (screen === "version") {
    const { renderVersion } = await importSettingsScreen("./version.js");
    renderVersion(context);
    return;
  }

  context.router.replace("settings.home", {}, { force: true });
}

export function unmount() {
  controller?.abort();
  controller = null;
}

export function canLeave() {
  return true;
}

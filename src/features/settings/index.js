import { getUserSettings, setUserSettings } from "../../shared/settings/user-settings-store.js";
import { renderBracketHeading } from "../../shared/ui/bracket-heading.js";
import { renderSectionMenu } from "../../shared/ui/list.js";
import { panel } from "../../shared/ui/panel.js";

const SETTINGS_ASSET_VERSION = "13.5";
let controller = null;

function renderSettingsHome(context, signal) {
  const settings = getUserSettings();
  context.root.innerHTML = panel({
    title: "Настройки",
    body: `
      <section class="settingsBlock">
        ${renderBracketHeading("Размер станции", { className: "settingsBlockTitle" })}
        <div class="settingsStationSize" role="radiogroup" aria-label="Количество слов в динамической станции">
          ${[20, 40].map((size) => `<label class="settingsChoice"><input type="radio" name="stationSize" value="${size}" ${settings.station_size === size ? "checked" : ""}><span>${size} слов</span></label>`).join("")}
        </div>
        <div class="settingsHint">По умолчанию 40. Карта перестраивается, прогресс слов сохраняется.</div>
      </section>
      <section class="settingsBlock settingsLinksBlock">
        ${renderSectionMenu([
          { id: "settings.privacy", title: "Политика конфиденциальности" },
          { id: "settings.version", title: "Версия приложения" },
        ], { dataName: "settings-route" })}
      </section>`,
  });

  context.root.querySelectorAll('input[name="stationSize"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      setUserSettings({ station_size: Number(radio.value) });
    }, { signal });
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

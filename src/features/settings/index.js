import {
  getDictionaryVersionStatus,
  getInstalledDictionaryVersion,
  refreshDictionary,
} from "../../shared/data/word-repository.js";
import { getUserSettings, setUserSettings } from "../../shared/settings/user-settings-store.js";
import { bindProfileNavigation, renderProfileNavigation } from "../../shared/ui/profile-navigation.js";
import { renderBracketHeading } from "../../shared/ui/bracket-heading.js";
import { escapeHtml } from "../../shared/ui/html.js";
import { renderSectionMenu } from "../../shared/ui/list.js";
import { panel } from "../../shared/ui/panel.js";

const SETTINGS_ASSET_VERSION = "13.6";
let controller = null;

async function renderSettingsHome(context, signal, { actionError = "" } = {}) {
  const settings = getUserSettings();
  const currentFallback = getInstalledDictionaryVersion();
  let versionStatus = null;
  let versionError = "";
  try {
    versionStatus = await getDictionaryVersionStatus();
  } catch (error) {
    versionError = "Не удалось проверить актуальную версию.";
  }
  const currentVersion = versionStatus?.currentVersion || currentFallback || "Не установлена";
  const latestVersion = versionStatus?.latestVersion || "Недоступна";
  const needsUpdate = versionStatus?.needsUpdate === true;

  context.root.innerHTML = `<section class="view screen settingsHomeView">
    ${renderProfileNavigation("settings")}
    <div class="settingsHomeScroll">
      ${renderBracketHeading("Настройки", { className: "settingsPageTitle" })}
      <section class="settingsBlock">
        ${renderBracketHeading("Размер станции", { className: "settingsBlockTitle" })}
        <div class="settingsStationSize" role="radiogroup" aria-label="Количество слов в динамической станции">
          ${[20, 40].map((size) => `<label class="settingsChoice"><input type="radio" name="stationSize" value="${size}" ${settings.station_size === size ? "checked" : ""}><span>${size} слов</span></label>`).join("")}
        </div>
        <div class="settingsHint">По умолчанию 40. Карта перестраивается, прогресс слов сохраняется.</div>
      </section>
      <section class="settingsBlock settingsDictionaryBlock">
        ${renderBracketHeading("Словарь", { className: "settingsBlockTitle" })}
        <dl class="settingsDictionaryVersions">
          <div><dt>Текущая версия</dt><dd>${escapeHtml(currentVersion)}</dd></div>
          <div><dt>Актуальная версия</dt><dd>${escapeHtml(latestVersion)}</dd></div>
        </dl>
        <div class="settingsDictionaryState ${needsUpdate ? "needsUpdate" : ""}" role="status">${versionError || (needsUpdate ? "Обновите словарь" : "Словарь обновлён")}</div>
        ${actionError ? `<div class="settingsDictionaryError" role="alert">${escapeHtml(actionError)}</div>` : ""}
        <button class="btn neutral settingsDictionaryButton" type="button" data-dictionary-refresh>Обновить словарь</button>
      </section>
      <section class="settingsBlock settingsLinksBlock">
        ${renderSectionMenu([
          { id: "settings.privacy", title: "Политика конфиденциальности" },
          { id: "settings.version", title: "Версия приложения" },
        ], { dataName: "settings-route" })}
      </section>
    </div>
  </section>`;

  bindProfileNavigation(context, signal);

  context.root.querySelectorAll('input[name="stationSize"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      setUserSettings({ station_size: Number(radio.value) });
    }, { signal });
  });

  context.root.querySelectorAll("[data-settings-route]").forEach((button) => {
    button.addEventListener("click", () => context.router.navigate(button.dataset.settingsRoute), { signal });
  });

  context.root.querySelector("[data-dictionary-refresh]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "Обновляем…";
    try {
      await refreshDictionary();
      await renderSettingsHome(context, signal);
    } catch (error) {
      await renderSettingsHome(context, signal, { actionError: error?.message || "Не удалось обновить словарь." });
    }
  }, { signal });
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
    await renderSettingsHome(context, controller.signal);
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

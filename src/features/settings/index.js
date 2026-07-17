import {
  getDictionaryVersionStatus,
  getInstalledDictionaryVersion,
  refreshDictionary,
} from "../../shared/data/word-repository.js?v=13.8.1";
import { getCurrentAuthState } from "../../shared/auth/auth-service.js?v=13.8.1";
import { readProgressQueue } from "../../shared/progress/progress-queue.js?v=13.8.1";
import { flushProgressQueue } from "../../shared/progress/progress-sync.js?v=13.8.1";
import { getUserSettings, setUserSettings } from "../../shared/settings/user-settings-store.js?v=13.8.1";
import { escapeHtml } from "../../shared/ui/html.js?v=13.8.1";
import { bindProfileNavigation, renderProfileNavigation } from "../../shared/ui/profile-navigation.js?v=13.8.1";

const SETTINGS_ASSET_VERSION = "13.8.1";
let controller = null;
let hasUnsavedChanges = false;
let draftSettings = null;

function sameSettings(left = {}, right = {}) {
  return left.interface_language_code === right.interface_language_code
    && left.alan_script_code === right.alan_script_code
    && left.alan_dialect_code === right.alan_dialect_code
    && Number(left.station_size) === Number(right.station_size);
}

function settingChoice({ name, value, label, checked, ariaLabel = "" }) {
  return `<label class="segmentOption settingsChoice" ${ariaLabel ? `aria-label="${escapeHtml(ariaLabel)}"` : ""}>
    <input type="radio" name="${escapeHtml(name)}" value="${escapeHtml(value)}" ${checked ? "checked" : ""}>
    <span>${escapeHtml(label)}</span>
  </label>`;
}

function settingRow(label, choices, { className = "", hidden = false } = {}) {
  return `<div class="settingsRow ${className}" ${hidden ? "hidden" : ""}>
    <span class="settingsRowLabel">${escapeHtml(label)}</span>
    <div class="segmentControl settingsSegments" role="radiogroup">${choices}</div>
  </div>`;
}

function settingsLink(route, title, value = "") {
  return `<button class="settingsLink" type="button" data-settings-route="${escapeHtml(route)}">
    <span>${escapeHtml(title)}</span>
    ${value ? `<span class="settingsLinkEnd"><small>${escapeHtml(value)}</small></span>` : ""}
  </button>`;
}

function updateSaveButton(root, saved = false) {
  const button = root.querySelector("[data-settings-save]");
  if (!button) return;
  button.disabled = !hasUnsavedChanges;
  button.classList.toggle("isDirty", hasUnsavedChanges);
  button.textContent = saved ? "Сохранено ✓" : "Сохранить";
}

function settingsSyncIsPending() {
  return readProgressQueue().some((entry) => entry.id === "user_settings:current");
}

async function renderSettingsHome(context, signal, { actionError = "" } = {}) {
  context.shell.setHeaderContent?.({ title: "Alan Til!" });
  let baselineSettings = getUserSettings();
  draftSettings = { ...baselineSettings };
  hasUnsavedChanges = false;

  const currentFallback = getInstalledDictionaryVersion();
  let versionStatus = null;
  let versionError = "";
  try {
    versionStatus = await getDictionaryVersionStatus();
  } catch {
    versionError = "Не удалось проверить актуальную версию.";
  }
  const currentVersion = versionStatus?.currentVersion || currentFallback || "Не установлена";
  const latestVersion = versionStatus?.latestVersion || "Недоступна";
  const needsUpdate = versionStatus?.needsUpdate === true;

  const languageChoices = [
    ["ru", "RU", "Русский"],
    ["en", "EN", "English"],
    ["tr", "TR", "Türkçe"],
  ].map(([value, label, ariaLabel]) => settingChoice({
    name: "interfaceLanguage",
    value,
    label,
    ariaLabel,
    checked: draftSettings.interface_language_code === value,
  })).join("");
  const scriptChoices = [
    ["cyrillic", "Кириллица"],
    ["turkic", "Latin"],
  ].map(([value, label]) => settingChoice({
    name: "alanScript",
    value,
    label,
    checked: draftSettings.alan_script_code === value,
  })).join("");
  const dialectChoices = [
    ["balkar", "Ж", "Балкарский вариант: Ж"],
    ["karachay", "Дж", "Карачаевский вариант: Дж"],
    ["canonical", "Җ", "Канонический вариант: Җ"],
  ].map(([value, label, ariaLabel]) => settingChoice({
    name: "alanDialect",
    value,
    label,
    ariaLabel,
    checked: draftSettings.alan_dialect_code === value,
  })).join("");
  const sizeChoices = [20, 40].map((value) => settingChoice({
    name: "stageSize",
    value,
    label: String(value),
    ariaLabel: `${value} слов в этапе`,
    checked: Number(draftSettings.station_size) === value,
  })).join("");

  context.root.innerHTML = `<section class="view screen settingsHomeView">
    ${renderProfileNavigation("settings")}
    <div class="settingsHomeScroll">
      <div class="settingsPageHead">
        <h1>Настройки</h1>
        <button class="btn actionPrimary actionCompact settingsSmallAction" type="button" data-settings-save disabled>Сохранить</button>
      </div>

      <section class="settingsSection">
        <h2 class="settingsSectionTitle">Языковые настройки</h2>
        ${settingRow("Язык интерфейса", languageChoices)}
        ${settingRow("Алфавит аланских слов", scriptChoices)}
        ${settingRow("Вариант кириллицы", dialectChoices, { className: "settingsDialectRow", hidden: draftSettings.alan_script_code === "turkic" })}
      </section>

      <section class="settingsSection">
        <h2 class="settingsSectionTitle">Изучение слов</h2>
        ${settingRow("Слов в этапе", sizeChoices)}
      </section>

      <section class="settingsSection settingsDictionarySection">
        <div class="settingsSectionHead">
          <h2 class="settingsSectionTitle">Версия словаря</h2>
          <span class="settingsUpdateWrap ${needsUpdate ? "needsUpdate" : ""}">
            <button class="btn actionPrimary actionCompact settingsSmallAction settingsUpdateButton" type="button" data-dictionary-refresh ${needsUpdate ? "" : "disabled"}>Обновить</button>
            ${needsUpdate ? '<span class="settingsUpdateBadge" aria-label="Доступно обновление">!</span>' : ""}
          </span>
        </div>
        <dl class="settingsDictionaryVersions">
          <div><dt>Текущая</dt><dd>${escapeHtml(currentVersion)}</dd></div>
          <div><dt>Актуальная</dt><dd>${escapeHtml(latestVersion)}</dd></div>
        </dl>
        ${needsUpdate ? '<div class="settingsDictionaryNotice" role="status">Обновите словарь</div>' : ""}
        ${versionError ? `<div class="settingsDictionaryError" role="alert">${escapeHtml(versionError)}</div>` : ""}
        ${actionError ? `<div class="settingsDictionaryError" role="alert">${escapeHtml(actionError)}</div>` : ""}
      </section>

      <section class="settingsSection settingsLinksSection" aria-label="О приложении">
        ${settingsLink("settings.thanks", "Благодарности")}
        ${settingsLink("settings.version", "Версия приложения", "13.8.1")}
        ${settingsLink("settings.privacy", "Политика конфиденциальности")}
      </section>
    </div>
  </section>`;

  bindProfileNavigation(context, signal);

  const markChanged = (updates) => {
    draftSettings = { ...draftSettings, ...updates };
    hasUnsavedChanges = !sameSettings(draftSettings, baselineSettings);
    updateSaveButton(context.root);
  };

  context.root.querySelectorAll('input[name="interfaceLanguage"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (radio.checked) markChanged({ interface_language_code: radio.value });
    }, { signal });
  });
  context.root.querySelectorAll('input[name="alanScript"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      markChanged({ alan_script_code: radio.value });
      const dialectRow = context.root.querySelector(".settingsDialectRow");
      if (dialectRow) dialectRow.hidden = radio.value === "turkic";
    }, { signal });
  });
  context.root.querySelectorAll('input[name="alanDialect"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (radio.checked) markChanged({ alan_dialect_code: radio.value });
    }, { signal });
  });
  context.root.querySelectorAll('input[name="stageSize"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (radio.checked) markChanged({ station_size: Number(radio.value) });
    }, { signal });
  });

  context.root.querySelector("[data-settings-save]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    if (!hasUnsavedChanges) return;
    button.disabled = true;
    button.textContent = "Сохраняем…";
    try {
      const authenticated = Boolean(getCurrentAuthState().user?.id);
      const persistedSettings = setUserSettings(draftSettings, {
        forceQueue: authenticated,
        requireStorage: true,
      });
      if (!sameSettings(persistedSettings, draftSettings)) {
        throw new Error("Локальное хранилище не подтвердило выбранные настройки.");
      }
      if (authenticated) {
        await flushProgressQueue();
        if (settingsSyncIsPending()) {
          throw new Error("Настройки сохранены на устройстве, но ещё не синхронизированы.");
        }
      }
      document.documentElement.lang = persistedSettings.interface_language_code || "ru";
      baselineSettings = { ...persistedSettings };
      draftSettings = { ...persistedSettings };
      hasUnsavedChanges = false;
      updateSaveButton(context.root, true);
      window.setTimeout(() => updateSaveButton(context.root), 1100);
    } catch (error) {
      button.textContent = "Повторить";
      button.disabled = false;
      button.classList.add("isDirty");
      console.error("Settings save failed", error);
    }
  }, { signal });

  context.root.querySelectorAll("[data-settings-route]").forEach((button) => {
    button.addEventListener("click", () => context.router.navigate(button.dataset.settingsRoute), { signal });
  });

  context.root.querySelector("[data-dictionary-refresh]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    if (!needsUpdate) return;
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
  hasUnsavedChanges = false;
  draftSettings = null;
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
  if (screen === "thanks") {
    const { renderThanks } = await importSettingsScreen("./thanks.js");
    renderThanks(context);
    return;
  }
  context.router.replace("settings.home", {}, { force: true });
}

export function unmount() {
  controller?.abort();
  controller = null;
  hasUnsavedChanges = false;
  draftSettings = null;
}

export function canLeave() {
  return !hasUnsavedChanges;
}

export function getLeaveMessage() {
  return "Настройки не сохранены.<br>Выйти без сохранения?";
}

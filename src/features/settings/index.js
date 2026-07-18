import { msg } from "../../shared/i18n/index.js?v=13.10.3";
import {
  getDictionaryVersionStatus,
  getInstalledDictionaryVersion,
  refreshDictionary,
} from "../../shared/data/word-repository.js?v=13.10.3";
import { getCurrentAuthState } from "../../shared/auth/auth-service.js?v=13.10.3";
import { readProgressQueue } from "../../shared/progress/progress-queue.js?v=13.10.8";
import { flushProgressQueue } from "../../shared/progress/progress-sync.js?v=13.10.3";
import { renderLearningPreview } from "../../shared/settings/learning-setup.js?v=13.10.8";
import { getUserSettings, setUserSettings } from "../../shared/settings/user-settings-store.js?v=13.10.8";
import { escapeHtml } from "../../shared/ui/html.js?v=13.9.0";
import { bindProfileNavigation, renderProfileNavigation } from "../../shared/ui/profile-navigation.js?v=13.9.0";

const SETTINGS_ASSET_VERSION = "13.10.8";
let controller = null;
let hasUnsavedChanges = false;
let draftSettings = null;

function sameSettings(left = {}, right = {}) {
  return left.interface_language_code === right.interface_language_code
    && left.translation_language_code === right.translation_language_code
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
  button.textContent = saved ? msg("settings.sohraneno") : msg("settings.sohranit");
}

function updateLearningPreview(root) {
  const current = root.querySelector('[data-learning-preview="settings"]');
  if (!current || !draftSettings) return;
  const template = document.createElement("template");
  template.innerHTML = renderLearningPreview(draftSettings, {
    className: "settingsLearningPreview",
    marker: "settings",
  }).trim();
  const next = template.content.firstElementChild;
  if (next) current.replaceWith(next);
}

function settingsSyncIsPending() {
  return readProgressQueue().some((entry) => entry.id === "user_settings:current");
}

function updateDictionaryVersionBlock(root, {
  currentVersion = getInstalledDictionaryVersion(),
  latestVersion = msg("settings.nedostupna"),
  needsUpdate = false,
  checking = false,
  error = "",
} = {}) {
  const current = root.querySelector("[data-dictionary-current]");
  const latest = root.querySelector("[data-dictionary-latest]");
  const button = root.querySelector("[data-dictionary-refresh]");
  const badge = root.querySelector("[data-dictionary-update-badge]");
  const notice = root.querySelector("[data-dictionary-update-notice]");
  const errorBox = root.querySelector("[data-dictionary-version-error]");

  if (current) current.textContent = currentVersion || msg("settings.ne_ustanovlena");
  if (latest) latest.textContent = checking ? "…" : (latestVersion || msg("settings.nedostupna"));
  if (button) {
    button.disabled = checking || !needsUpdate;
    button.closest(".settingsUpdateWrap")?.classList.toggle("needsUpdate", needsUpdate);
  }
  if (badge) badge.hidden = !needsUpdate;
  if (notice) notice.hidden = !needsUpdate;
  if (errorBox) {
    errorBox.hidden = !error;
    errorBox.textContent = error;
  }
}

async function updateDictionaryVersionStatus(root, signal) {
  updateDictionaryVersionBlock(root, { checking: true });
  try {
    const status = await getDictionaryVersionStatus({ signal, retry: false });
    if (signal.aborted || !root.isConnected) return;
    updateDictionaryVersionBlock(root, status);
  } catch {
    if (signal.aborted || !root.isConnected) return;
    updateDictionaryVersionBlock(root, {
      currentVersion: getInstalledDictionaryVersion(),
      error: msg("settings.ne_udalos_proverit_aktualnuyu_versiyu"),
    });
  }
}

function renderSettingsHome(context, signal, { actionError = "" } = {}) {
  context.shell.setHeaderContent?.({ title: "Alan Til!" });
  let baselineSettings = getUserSettings();
  draftSettings = { ...baselineSettings };
  hasUnsavedChanges = false;
  const currentVersion = getInstalledDictionaryVersion();

  const languageChoices = [
    ["ru", "RU", msg("settings.russkiy")],
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
    ["cyrillic", msg("settings.kirillitsa")],
    ["turkic", "Latin"],
  ].map(([value, label]) => settingChoice({
    name: "alanScript",
    value,
    label,
    checked: draftSettings.alan_script_code === value,
  })).join("");
  const dialectChoices = [
    ["canonical", "Җ"],
    ["karachay", "Дж"],
    ["balkar", "Ж"],
  ].map(([value, label]) => settingChoice({
    name: "alanDialect",
    value,
    label,
    checked: draftSettings.alan_dialect_code === value,
  })).join("");
  const sizeChoices = [20, 40].map((value) => settingChoice({
    name: "stageSize",
    value,
    label: String(value),
    ariaLabel: msg("settings.slov_v_etape", { value }),
    checked: Number(draftSettings.station_size) === value,
  })).join("");

  context.root.innerHTML = `<section class="view screen settingsHomeView">
    ${renderProfileNavigation("settings")}
    <div class="settingsHomeScroll">
      <div class="settingsPageHead">
        <h1>${msg("settings.nastroyki")}</h1>
        <button class="btn actionPrimary actionCompact settingsSmallAction" type="button" data-settings-save disabled>${msg("settings.sohranit")}</button>
      </div>

      <section class="settingsSection">
        <h2 class="settingsSectionTitle">${msg("settings.yazykovye_nastroyki")}</h2>
        ${settingRow(msg("settings.yazyk_interfeysa"), languageChoices)}
        ${settingRow(msg("settings.alfavit_alanskih_slov"), scriptChoices)}
        ${settingRow(msg("settings.variant_kirillitsy"), dialectChoices, { className: "settingsDialectRow", hidden: draftSettings.alan_script_code === "turkic" })}
        ${renderLearningPreview(draftSettings, { className: "settingsLearningPreview", marker: "settings" })}
      </section>

      <section class="settingsSection">
        <h2 class="settingsSectionTitle">${msg("settings.izuchenie_slov")}</h2>
        ${settingRow(msg("settings.slov_v_etape_2"), sizeChoices)}
      </section>

      <section class="settingsSection settingsDictionarySection">
        <div class="settingsSectionHead">
          <h2 class="settingsSectionTitle">${msg("settings.versiya_slovarya")}</h2>
          <span class="settingsUpdateWrap">
            <button class="btn actionPrimary actionCompact settingsSmallAction settingsUpdateButton" type="button" data-dictionary-refresh disabled>${msg("settings.obnovit")}</button>
            <span data-dictionary-update-badge class="settingsUpdateBadge" aria-label="${msg("settings.dostupno_obnovlenie")}" hidden>!</span>
          </span>
        </div>
        <dl class="settingsDictionaryVersions">
          <div><dt>${msg("settings.tekuschaya")}</dt><dd data-dictionary-current>${escapeHtml(currentVersion || msg("settings.ne_ustanovlena"))}</dd></div>
          <div><dt>${msg("settings.aktualnaya")}</dt><dd data-dictionary-latest>…</dd></div>
        </dl>
        <div data-dictionary-update-notice class="settingsDictionaryNotice" role="status" hidden>${msg("settings.obnovite_slovar")}</div>
        <div data-dictionary-version-error class="settingsDictionaryError" role="alert" hidden></div>
        ${actionError ? `<div class="settingsDictionaryError" role="alert">${escapeHtml(actionError)}</div>` : ""}
      </section>

      <section class="settingsSection settingsLinksSection" aria-label="${msg("settings.o_prilozhenii")}">
        ${settingsLink("settings.thanks", msg("settings.blagodarnosti"))}
        ${settingsLink("settings.version", msg("settings.versiya_prilozheniya"), "13.10.8")}
        ${settingsLink("settings.privacy", msg("settings.politika_konfidentsialnosti"))}
      </section>
    </div>
  </section>`;

  bindProfileNavigation(context, signal);

  const markChanged = (updates) => {
    draftSettings = { ...draftSettings, ...updates };
    hasUnsavedChanges = !sameSettings(draftSettings, baselineSettings);
    updateSaveButton(context.root);
    updateLearningPreview(context.root);
  };

  context.root.querySelectorAll('input[name="interfaceLanguage"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (radio.checked) markChanged({
        interface_language_code: radio.value,
        translation_language_code: radio.value,
      });
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
    button.textContent = msg("settings.sohranyaem");
    try {
      const authenticated = Boolean(getCurrentAuthState().user?.id);
      const persistedSettings = setUserSettings(draftSettings, {
        forceQueue: authenticated,
        requireStorage: true,
      });
      if (!sameSettings(persistedSettings, draftSettings)) {
        throw new Error(msg("settings.lokalnoe_hranilische_ne_podtverdilo_vybrannye_nastroyki"));
      }
      if (authenticated) {
        await flushProgressQueue();
        if (settingsSyncIsPending()) {
          throw new Error(msg("settings.nastroyki_sohraneny_na_ustroystve_no_esche_ne"));
        }
      }
      document.documentElement.lang = persistedSettings.interface_language_code || "ru";
      baselineSettings = { ...persistedSettings };
      draftSettings = { ...persistedSettings };
      hasUnsavedChanges = false;
      updateSaveButton(context.root, true);
      await context.router.refresh();
    } catch (error) {
      button.textContent = msg("settings.povtorit");
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
    button.disabled = true;
    button.textContent = msg("settings.obnovlyaem");
    try {
      await refreshDictionary({ signal });
      if (!signal.aborted) renderSettingsHome(context, signal);
    } catch (error) {
      if (!signal.aborted) renderSettingsHome(context, signal, { actionError: error?.message || msg("settings.ne_udalos_obnovit_slovar") });
    }
  }, { signal });

  void updateDictionaryVersionStatus(context.root, signal);
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
  return msg("settings.nastroyki_ne_sohraneny_vyyti_bez_sohraneniya").replace("\n", "<br>");
}

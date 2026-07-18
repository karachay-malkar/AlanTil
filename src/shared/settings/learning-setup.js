import { escapeHtml } from "../ui/html.js?v=13.9.0";
import {
  LEARNING_SETUP_LANGUAGES,
  previewContent,
  setupText,
} from "./learning-preview-data.js?v=13.10.8";

function flagSvg(language) {
  if (language === "ru") {
    return `<svg viewBox="0 0 24 16" aria-hidden="true"><path fill="#fff" d="M0 0h24v5.34H0z"/><path fill="#1c57a7" d="M0 5.33h24v5.34H0z"/><path fill="#d52b1e" d="M0 10.66h24V16H0z"/></svg>`;
  }
  if (language === "tr") {
    return `<svg viewBox="0 0 24 16" aria-hidden="true"><path fill="#e30a17" d="M0 0h24v16H0z"/><circle cx="9" cy="8" r="4.2" fill="#fff"/><circle cx="10.2" cy="8" r="3.35" fill="#e30a17"/><path fill="#fff" d="m14.1 8 2.7-.9-1.7 2.3V6.6l1.7 2.3z"/></svg>`;
  }
  return `<svg viewBox="0 0 24 16" aria-hidden="true"><path fill="#21468b" d="M0 0h24v16H0z"/><path stroke="#fff" stroke-width="4" d="m0 0 24 16M24 0 0 16"/><path stroke="#cf142b" stroke-width="2" d="m0 0 24 16M24 0 0 16"/><path stroke="#fff" stroke-width="6" d="M12 0v16M0 8h24"/><path stroke="#cf142b" stroke-width="3.5" d="M12 0v16M0 8h24"/></svg>`;
}

function choice({ name, value, label, checked, detail = "", extraClass = "" }) {
  return `<label class="learningSetupChoice ${extraClass}">
    <input type="radio" name="${escapeHtml(name)}" value="${escapeHtml(value)}" ${checked ? "checked" : ""}>
    <span class="learningSetupChoiceBody">
      <span class="learningSetupChoiceLabel">${label}</span>
      ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
    </span>
  </label>`;
}

export function emptyLearningSetupDraft() {
  return {
    interface_language_code: "",
    translation_language_code: "",
    alan_script_code: "",
    alan_dialect_code: "",
  };
}

export function isLearningSetupDraftComplete(draft = {}) {
  if (!["ru", "en", "tr"].includes(draft.interface_language_code)) return false;
  if (!["cyrillic", "turkic"].includes(draft.alan_script_code)) return false;
  if (draft.alan_script_code === "cyrillic"
      && !["canonical", "karachay", "balkar"].includes(draft.alan_dialect_code)) return false;
  return true;
}

export function renderLearningPreview(settings = {}, { className = "", marker = "" } = {}) {
  const language = settings.interface_language_code;
  const copy = setupText(language || "ru");
  const ready = Boolean(language && settings.alan_script_code
    && (settings.alan_script_code === "turkic" || settings.alan_dialect_code));
  const preview = ready ? previewContent(settings) : null;
  const classes = ["learningSetupPreview", preview ? "isVisible" : "", className].filter(Boolean).join(" ");
  const markerAttribute = marker ? ` data-learning-preview="${escapeHtml(marker)}"` : "";
  return `<section class="${escapeHtml(classes)}"${markerAttribute} aria-label="${escapeHtml(copy.preview)}" aria-live="polite">
    ${preview ? `<div class="learningPreviewWord">${escapeHtml(preview.word)}</div>
      <div class="learningPreviewTranslation">${escapeHtml(preview.translation)}</div>
      <div class="learningPreviewExample"><span>${escapeHtml(preview.example)}</span><b aria-hidden="true">✦</b><span>${escapeHtml(preview.exampleTranslation)}</span></div>` : ""}
  </section>`;
}

export function renderLearningSetup(draft = {}, { error = "" } = {}) {
  const language = draft.interface_language_code;
  const copy = setupText(language || "ru");
  const title = language
    ? copy.title
    : "Настрой обучение под себя · Set up learning · Öğrenmeni ayarla";

  const languageChoices = LEARNING_SETUP_LANGUAGES.map((option) => choice({
    name: "learningLanguage",
    value: option.code,
    checked: language === option.code,
    label: `<span class="learningSetupFlag">${flagSvg(option.code)}</span><span>${escapeHtml(option.label)}</span>`,
    extraClass: "learningSetupLanguageChoice",
  })).join("");

  const scriptChoices = [
    { value: "cyrillic", label: copy.cyrillic, detail: "җигер" },
    { value: "turkic", label: "Latin", detail: "ciger" },
  ].map((option) => choice({
    name: "learningScript",
    value: option.value,
    label: escapeHtml(option.label),
    detail: option.detail,
    checked: draft.alan_script_code === option.value,
  })).join("");

  const dialectChoices = [
    ["canonical", "Җ"],
    ["karachay", "Дж"],
    ["balkar", "Ж"],
  ].map(([value, label]) => choice({
    name: "learningDialect",
    value,
    label,
    checked: draft.alan_dialect_code === value,
    extraClass: "learningSetupDialectChoice",
  })).join("");

  return `<section class="learningSetupScreen">
    <div class="learningSetupPane">
      <header class="learningSetupHead">
        <span class="learningSetupKicker">ALAN TIL</span>
        <h1>${escapeHtml(title)}</h1>
      </header>

      ${error ? `<div class="learningSetupError" role="alert">${escapeHtml(error)}</div>` : ""}

      <section class="learningSetupStep isVisible" data-setup-step="language">
        <h2>Язык · Language · Dil</h2>
        <div class="learningSetupChoices learningSetupLanguageChoices" role="radiogroup">${languageChoices}</div>
      </section>

      <section class="learningSetupStep ${language ? "isVisible" : ""}" data-setup-step="script" aria-hidden="${language ? "false" : "true"}">
        <h2>${escapeHtml(copy.script)}</h2>
        <div class="learningSetupChoices" role="radiogroup">${scriptChoices}</div>
      </section>

      <section class="learningSetupStep ${draft.alan_script_code === "cyrillic" ? "isVisible" : ""}" data-setup-step="dialect" aria-hidden="${draft.alan_script_code === "cyrillic" ? "false" : "true"}">
        <h2>${escapeHtml(copy.dialect)}</h2>
        <div class="learningSetupChoices learningSetupDialectChoices" role="radiogroup">${dialectChoices}</div>
      </section>

      ${renderLearningPreview(draft)}

      <button class="btn actionPrimary learningSetupContinue" type="button" data-learning-setup-continue ${isLearningSetupDraftComplete(draft) ? "" : "disabled"}>${escapeHtml(copy.continue)}</button>
    </div>
  </section>`;
}

export function bindLearningSetup(root, signal, { onChange, onContinue } = {}) {
  root.querySelectorAll('input[name="learningLanguage"]').forEach((input) => {
    input.addEventListener("change", () => input.checked && onChange?.({
      interface_language_code: input.value,
      translation_language_code: input.value,
    }), { signal });
  });
  root.querySelectorAll('input[name="learningScript"]').forEach((input) => {
    input.addEventListener("change", () => input.checked && onChange?.({ alan_script_code: input.value }), { signal });
  });
  root.querySelectorAll('input[name="learningDialect"]').forEach((input) => {
    input.addEventListener("change", () => input.checked && onChange?.({ alan_dialect_code: input.value }), { signal });
  });
  root.querySelector("[data-learning-setup-continue]")?.addEventListener("click", () => onContinue?.(), { signal });
}

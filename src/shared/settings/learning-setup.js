import { escapeHtml } from "../ui/html.js?v=13.9.0";
import {
  LEARNING_SETUP_LANGUAGES,
  previewContent,
  setupText,
} from "./learning-preview-data.js?v=13.10.9";

function flagSvg(language) {
  if (language === "ru") {
    return `<svg viewBox="0 0 24 16" aria-hidden="true"><path fill="#fff" d="M0 0h24v5.34H0z"/><path fill="#1c57a7" d="M0 5.33h24v5.34H0z"/><path fill="#d52b1e" d="M0 10.66h24V16H0z"/></svg>`;
  }
  if (language === "tr") {
    return `<svg viewBox="0 0 24 16" aria-hidden="true"><path fill="#e30a17" d="M0 0h24v16H0z"/><circle cx="9" cy="8" r="4.2" fill="#fff"/><circle cx="10.2" cy="8" r="3.35" fill="#e30a17"/><path fill="#fff" d="m14.1 8 2.7-.9-1.7 2.3V6.6l1.7 2.3z"/></svg>`;
  }
  return `<svg viewBox="0 0 24 16" aria-hidden="true"><path fill="#21468b" d="M0 0h24v16H0z"/><path stroke="#fff" stroke-width="4" d="m0 0 24 16M24 0 0 16"/><path stroke="#cf142b" stroke-width="2" d="m0 0 24 16M24 0 0 16"/><path stroke="#fff" stroke-width="6" d="M12 0v16M0 8h24"/><path stroke="#cf142b" stroke-width="3.5" d="M12 0v16M0 8h24"/></svg>`;
}

function choice({ name, value, label, checked, extraClass = "" }) {
  return `<label class="settingsChoice ${extraClass}">
    <input type="radio" name="${escapeHtml(name)}" value="${escapeHtml(value)}" ${checked ? "checked" : ""}>
    <span class="settingsChoiceBody">${label}</span>
  </label>`;
}

function capitalizeWord(value) {
  const text = String(value || "");
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : "";
}

function segmentedControl(choices, className = "") {
  return `<div class="segmentControl settingsSegments ${escapeHtml(className)}" role="radiogroup">${choices}</div>`;
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
  const copy = setupText(settings.interface_language_code || "ru");
  const preview = previewContent(settings);
  const classes = ["learnCard", "learningSetupCard", className].filter(Boolean).join(" ");
  const markerAttribute = marker ? ` data-learning-preview="${escapeHtml(marker)}"` : "";
  return `<article class="${escapeHtml(classes)}"${markerAttribute} aria-label="${escapeHtml(copy.preview)}" aria-live="polite">
    <div class="cardInner">
      <div class="cardFace cardFront">
        <div class="groups">
          <div class="word">${escapeHtml(capitalizeWord(preview.word))}</div>
          <div class="groupPill">
            <div class="gTrans">${escapeHtml(preview.translation)}</div>
            <div class="gEx">${escapeHtml(preview.example)} <span aria-hidden="true">✦</span> ${escapeHtml(preview.exampleTranslation)}</div>
          </div>
        </div>
      </div>
    </div>
  </article>`;
}

export function renderLearningSetup(draft = {}, { error = "" } = {}) {
  const language = draft.interface_language_code;
  const copy = setupText(language || "ru");

  const languageChoices = LEARNING_SETUP_LANGUAGES.map((option) => choice({
    name: "learningLanguage",
    value: option.code,
    checked: language === option.code,
    label: `<span class="learningSetupFlag">${flagSvg(option.code)}</span><span>${escapeHtml(option.label)}</span>`,
  })).join("");

  const scriptChoices = [
    ["cyrillic", copy.cyrillic],
    ["turkic", "Latin"],
  ].map(([value, label]) => choice({
    name: "learningScript",
    value,
    label: escapeHtml(label),
    checked: draft.alan_script_code === value,
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
  })).join("");

  return `<section class="learningSetupScreen">
    <div class="learningSetupPane">
      ${error ? `<div class="learningSetupError" role="alert">${escapeHtml(error)}</div>` : ""}

      <section class="learningSetupStep isVisible" data-setup-step="language">
        <h1>Язык · Language · Dil</h1>
        ${segmentedControl(languageChoices, "learningSetupLanguageSegments")}
      </section>

      <section class="learningSetupStep ${language ? "isVisible" : ""}" data-setup-step="script" aria-hidden="${language ? "false" : "true"}">
        <h2>${escapeHtml(copy.script)}</h2>
        ${segmentedControl(scriptChoices)}
      </section>

      <section class="learningSetupStep ${draft.alan_script_code === "cyrillic" ? "isVisible" : ""}" data-setup-step="dialect" aria-hidden="${draft.alan_script_code === "cyrillic" ? "false" : "true"}">
        <h2>${escapeHtml(copy.dialect)}</h2>
        ${segmentedControl(dialectChoices)}
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

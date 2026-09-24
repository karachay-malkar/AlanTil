import { escapeHtml } from "../ui/html.js?v=16.8.0.2";
import {
  LEARNING_SETUP_LANGUAGES,
  previewContent,
  setupText,
} from "./learning-preview-data.js?v=16.8.0.2";
import {
  emptyLearningSetupDraft,
  isLearningSetupDraftComplete,
} from "../../../packages/alantil-core/settings.js";

export { emptyLearningSetupDraft, isLearningSetupDraftComplete };

const previewAnimations = new WeakMap();

function flagSvg(language) {
  if (language === "ru") {
    return `<svg viewBox="0 0 24 16" aria-hidden="true"><path fill="#fff" d="M0 0h24v5.34H0z"/><path fill="#1c57a7" d="M0 5.33h24v5.34H0z"/><path fill="#d52b1e" d="M0 10.66h24V16H0z"/></svg>`;
  }
  if (language === "tr") {
    return `<svg viewBox="0 0 24 16" aria-hidden="true"><path fill="#e30a17" d="M0 0h24v16H0z"/><circle cx="9" cy="8" r="4.2" fill="#fff"/><circle cx="10.2" cy="8" r="3.35" fill="#e30a17"/><path fill="#fff" d="m14.1 8 2.7-.9-1.7 2.3V6.6l1.7 2.3z"/></svg>`;
  }
  return `<svg viewBox="0 0 24 16" aria-hidden="true"><path fill="#21468b" d="M0 0h24v16H0z"/><path stroke="#fff" stroke-width="4" d="m0 0 24 16M24 0 0 16"/><path stroke="#cf142b" stroke-width="2" d="m0 0 24 16M24 0 0 16"/><path stroke="#fff" stroke-width="6" d="M12 0v16M0 8h24"/><path stroke="#cf142b" stroke-width="3.5" d="M12 0v16M0 8h24"/></svg>`;
}

function choice({ name, value, label, checked, disabled = false, extraClass = "" }) {
  return `<label class="settingsChoice ${extraClass}">
    <input type="radio" name="${escapeHtml(name)}" value="${escapeHtml(value)}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}>
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

function prefersReducedMotion() {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
}

function animatePreviewField(element) {
  if (!element?.animate || prefersReducedMotion()) return;

  previewAnimations.get(element)?.cancel();
  let glow = "rgba(139,107,59,.2)";
  try {
    glow = getComputedStyle(element).getPropertyValue("--accent-glow").trim() || glow;
  } catch {}

  try {
    const animation = element.animate([
      { opacity: 0.58, transform: "translateY(2px)", filter: "blur(1.2px)", textShadow: "0 0 0 transparent" },
      { offset: 0.42, opacity: 1, transform: "translateY(0)", filter: "blur(0)", textShadow: `0 0 12px ${glow}` },
      { opacity: 1, transform: "translateY(0)", filter: "blur(0)", textShadow: "0 0 0 transparent" },
    ], {
      duration: 360,
      easing: "cubic-bezier(.2,.7,.2,1)",
    });
    previewAnimations.set(element, animation);
    animation.addEventListener("finish", () => {
      if (previewAnimations.get(element) === animation) previewAnimations.delete(element);
    }, { once: true });
    animation.addEventListener("cancel", () => {
      if (previewAnimations.get(element) === animation) previewAnimations.delete(element);
    }, { once: true });
  } catch {}
}

function updatePreviewField(root, selector, value, animate) {
  const element = root?.querySelector?.(selector);
  if (!element) return false;
  const next = String(value || "");
  if (element.textContent === next) return false;
  element.textContent = next;
  if (animate) animatePreviewField(element);
  return true;
}

export function renderLearningPreview(settings = {}, { className = "", marker = "default" } = {}) {
  const copy = setupText(settings.interface_language_code || "ru");
  const preview = previewContent(settings);
  const classes = ["learningPreviewCard", className].filter(Boolean).join(" ");
  return `<article class="${escapeHtml(classes)}" data-learning-preview="${escapeHtml(marker)}" aria-label="${escapeHtml(copy.preview)}" aria-live="polite" aria-atomic="true">
    <div class="learningPreviewSurface">
      <div class="learningPreviewContent">
        <div class="learningPreviewWord" data-preview-word>${escapeHtml(capitalizeWord(preview.word))}</div>
        <div class="learningPreviewDetails">
          <div class="learningPreviewTranslation" data-preview-translation>${escapeHtml(preview.translation)}</div>
          <div class="learningPreviewExample">
            <span data-preview-example>${escapeHtml(preview.example)}</span>
            <span class="learningPreviewSeparator" aria-hidden="true">✦</span>
            <span data-preview-example-translation>${escapeHtml(preview.exampleTranslation)}</span>
          </div>
        </div>
      </div>
    </div>
  </article>`;
}

export function syncLearningPreview(root, settings = {}, { animate = false } = {}) {
  if (!root) return false;
  const previewRoot = root.matches?.("[data-learning-preview]")
    ? root
    : root.querySelector?.("[data-learning-preview]");
  if (!previewRoot) return false;

  const copy = setupText(settings.interface_language_code || "ru");
  const preview = previewContent(settings);
  previewRoot.setAttribute("aria-label", copy.preview);

  let changed = false;
  changed = updatePreviewField(previewRoot, "[data-preview-word]", capitalizeWord(preview.word), animate) || changed;
  changed = updatePreviewField(previewRoot, "[data-preview-translation]", preview.translation, animate) || changed;
  changed = updatePreviewField(previewRoot, "[data-preview-example]", preview.example, animate) || changed;
  changed = updatePreviewField(previewRoot, "[data-preview-example-translation]", preview.exampleTranslation, animate) || changed;
  return changed;
}

function syncRadioGroup(root, name, value) {
  root.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
    input.checked = input.value === value;
  });
}

function setSetupStepState(root, stepName, visible) {
  const step = root.querySelector(`[data-setup-step="${stepName}"]`);
  if (!step) return;
  step.classList.toggle("isVisible", visible);
  step.setAttribute("aria-hidden", visible ? "false" : "true");
  step.toggleAttribute("inert", !visible);
  try {
    step.inert = !visible;
  } catch {}
  step.querySelectorAll("input,button,select,textarea").forEach((control) => {
    control.disabled = !visible;
  });
}

function setSetupCopy(root, name, value) {
  const element = root.querySelector(`[data-learning-setup-copy="${name}"]`);
  if (element) element.textContent = value;
}

export function syncLearningSetupView(root, draft = {}, {
  error = "",
  animatePreview = false,
} = {}) {
  if (!root) return false;
  const language = draft.interface_language_code;
  const copy = setupText(language || "ru");
  const scriptVisible = Boolean(language);
  const dialectVisible = draft.alan_script_code === "cyrillic";

  syncRadioGroup(root, "learningLanguage", language);
  syncRadioGroup(root, "learningScript", draft.alan_script_code);
  syncRadioGroup(root, "learningDialect", draft.alan_dialect_code);

  setSetupCopy(root, "script-title", copy.script);
  setSetupCopy(root, "cyrillic", copy.cyrillic);
  setSetupCopy(root, "dialect-title", copy.dialect);
  setSetupCopy(root, "continue", copy.continue);

  setSetupStepState(root, "language", true);
  setSetupStepState(root, "script", scriptVisible);
  setSetupStepState(root, "dialect", dialectVisible);

  const continueButton = root.querySelector("[data-learning-setup-continue]");
  if (continueButton) continueButton.disabled = !isLearningSetupDraftComplete(draft);

  const status = root.querySelector("[data-learning-setup-status]");
  if (status) {
    status.textContent = error || "";
    status.classList.toggle("isVisible", Boolean(error));
    status.setAttribute("aria-hidden", error ? "false" : "true");
  }

  const preview = root.querySelector('[data-learning-preview="onboarding"]');
  syncLearningPreview(preview, draft, { animate: animatePreview });
  return true;
}

export function renderLearningSetup(draft = {}, { error = "" } = {}) {
  const language = draft.interface_language_code;
  const copy = setupText(language || "ru");
  const scriptVisible = Boolean(language);
  const dialectVisible = draft.alan_script_code === "cyrillic";

  const languageChoices = LEARNING_SETUP_LANGUAGES.map((option) => choice({
    name: "learningLanguage",
    value: option.code,
    checked: language === option.code,
    label: `<span class="learningSetupFlag">${flagSvg(option.code)}</span><span>${escapeHtml(option.label)}</span>`,
  })).join("");

  const scriptChoices = [
    ["cyrillic", `<span data-learning-setup-copy="cyrillic">${escapeHtml(copy.cyrillic)}</span>`],
    ["turkic", "Latin"],
  ].map(([value, label]) => choice({
    name: "learningScript",
    value,
    label,
    checked: draft.alan_script_code === value,
    disabled: !scriptVisible,
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
    disabled: !dialectVisible,
  })).join("");

  return `<section class="learningSetupScreen">
    <div class="learningSetupPane">
      <section class="learningSetupStep isVisible" data-setup-step="language" aria-hidden="false">
        <h1>Язык · Language · Dil</h1>
        ${segmentedControl(languageChoices, "learningSetupLanguageSegments")}
      </section>

      <section class="learningSetupStep ${scriptVisible ? "isVisible" : ""}" data-setup-step="script" aria-hidden="${scriptVisible ? "false" : "true"}" ${scriptVisible ? "" : "inert"}>
        <h2 data-learning-setup-copy="script-title">${escapeHtml(copy.script)}</h2>
        ${segmentedControl(scriptChoices)}
      </section>

      <section class="learningSetupStep ${dialectVisible ? "isVisible" : ""}" data-setup-step="dialect" aria-hidden="${dialectVisible ? "false" : "true"}" ${dialectVisible ? "" : "inert"}>
        <h2 data-learning-setup-copy="dialect-title">${escapeHtml(copy.dialect)}</h2>
        ${segmentedControl(dialectChoices)}
      </section>

      ${renderLearningPreview(draft, { className: "learningSetupCard", marker: "onboarding" })}

      <button class="btn actionPrimary learningSetupContinue" type="button" data-learning-setup-continue ${isLearningSetupDraftComplete(draft) ? "" : "disabled"}><span data-learning-setup-copy="continue">${escapeHtml(copy.continue)}</span></button>
      <div class="learningSetupStatus learningSetupError ${error ? "isVisible" : ""}" data-learning-setup-status role="alert" aria-live="assertive" aria-hidden="${error ? "false" : "true"}">${escapeHtml(error)}</div>
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

import { msg } from "../i18n/index.js?v=13.9.0";
import { escapeHtml } from "./html.js?v=13.9.0";

function loadingLabel() {
  return msg("common.vypolnyaetsya_vhod");
}

function normalizeProvider(value) {
  return String(value || "").trim().toLowerCase();
}

export function renderAuthProviderButton({
  provider,
  label,
  icon,
  disabled = false,
  loading = false,
} = {}) {
  const normalizedProvider = normalizeProvider(provider);
  const safeLabel = String(label || msg("common.voyti")).trim() || msg("common.voyti");
  const buttonLabel = loading ? loadingLabel() : safeLabel;
  const classes = `btn actionPrimary authProviderButton${loading ? " isLoading" : ""}`;
  const isDisabled = Boolean(disabled || loading);

  return `
    <button
      class="${classes}"
      type="button"
      data-auth-provider="${escapeHtml(normalizedProvider)}"
      data-auth-provider-label="${escapeHtml(safeLabel)}"
      ${isDisabled ? "disabled" : ""}
      aria-busy="${loading ? "true" : "false"}"
    >
      ${icon ? `<img class="authProviderIcon" src="${escapeHtml(icon)}" alt="" aria-hidden="true" />` : `<span class="authProviderIcon" aria-hidden="true"></span>`}
      <span class="authProviderLabel">${escapeHtml(buttonLabel)}</span>
    </button>`;
}

export function setAuthProviderButtonState(button, {
  loading = false,
  disabled = false,
  label,
} = {}) {
  if (!button) return;
  const storedLabel = String(label || button.dataset.authProviderLabel || msg("common.voyti")).trim() || msg("common.voyti");
  button.dataset.authProviderLabel = storedLabel;
  button.classList.toggle("isLoading", Boolean(loading));
  button.disabled = Boolean(disabled || loading);
  button.setAttribute("aria-busy", loading ? "true" : "false");
  const labelElement = button.querySelector(".authProviderLabel");
  if (labelElement) labelElement.textContent = loading ? loadingLabel() : storedLabel;
}

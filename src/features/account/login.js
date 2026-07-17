import { getEnabledAuthProviders } from "../../config/auth-providers.js?v=13.10.2";
import { msg } from "../../shared/i18n/index.js?v=13.10.2";
import { renderAuthProviderButton, setAuthProviderButtonState } from "../../shared/ui/auth-provider-button.js?v=13.9.0";
import { escapeHtml } from "../../shared/ui/html.js?v=13.9.0";
import { panel } from "../../shared/ui/panel.js?v=13.9.0";

function renderGoogleProvider(label, icon) {
  return `<div id="googleIdentityButton" class="googleIdentityButton" data-google-state="loading" role="group" aria-label="${escapeHtml(label)}">
    <button class="btn authProviderButton googleIdentityFallback" type="button" data-google-fallback>
      <img class="authProviderIcon" src="${escapeHtml(icon)}" alt="" aria-hidden="true" />
      <span class="authProviderLabel">${escapeHtml(label)}</span>
      <span class="googleIdentitySpinner" aria-hidden="true"></span>
    </button>
    <div class="googleIdentityOfficial" data-google-official></div>
    <div class="googleIdentityStatus" data-google-status aria-live="polite"></div>
  </div>`;
}

function renderProvider(provider) {
  const label = msg(provider.labelKey);
  if (provider.identityButton && provider.id === "google") {
    return renderGoogleProvider(label, provider.icon);
  }
  return renderAuthProviderButton({ provider: provider.id, label, icon: provider.icon });
}

export function renderLogin(context, { error = "" } = {}) {
  const providers = getEnabledAuthProviders();
  context.shell.setHeaderContent?.({ title: msg("account.vhod") });
  context.root.innerHTML = panel({
    title: msg("account.akkaunt"),
    classes: "accountPanel",
    viewClasses: "accountView",
    body: `<div class="accountStack">
      ${error ? `<div class="accountMessage accountMessageError" role="alert">${escapeHtml(error)}</div>` : ""}
      <div class="authProviderList">${providers.map(renderProvider).join("")}</div>
      <button id="accountContinueGuest" class="btn actionText accountAction" type="button">${msg("account.prodolzhit_kak_gost")}</button>
    </div>`,
  });
}

export function bindLogin(context, signal, {
  onGoogleMount,
  onProvider,
  onGuest,
} = {}) {
  const googleContainer = context.root.querySelector("#googleIdentityButton");
  if (googleContainer) onGoogleMount?.(googleContainer);

  context.root.querySelectorAll("[data-auth-provider]").forEach((button) => {
    button.addEventListener("click", async () => {
      const provider = button.dataset.authProvider;
      setAuthProviderButtonState(button, { loading: true });
      try {
        await onProvider?.(provider);
      } catch {
        if (button.isConnected) setAuthProviderButtonState(button, { loading: false });
      }
    }, { signal });
  });
  context.root.querySelector("#accountContinueGuest")?.addEventListener("click", () => onGuest?.(), { signal });
}

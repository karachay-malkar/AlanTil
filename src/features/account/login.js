import { getEnabledAuthProviders } from "../../config/auth-providers.js?v=13.10.1";
import { msg } from "../../shared/i18n/index.js?v=13.10.1";
import { renderAuthProviderButton, setAuthProviderButtonState } from "../../shared/ui/auth-provider-button.js?v=13.9.0";
import { escapeHtml } from "../../shared/ui/html.js?v=13.9.0";
import { panel } from "../../shared/ui/panel.js?v=13.9.0";

function renderProvider(provider) {
  const label = msg(provider.labelKey);
  if (provider.identityButton && provider.id === "google") {
    return `<div id="googleIdentityButton" class="googleIdentityButton" role="group" aria-label="${escapeHtml(label)}">
      <span class="googleIdentityLoading">${escapeHtml(label)}</span>
    </div>`;
  }
  return renderAuthProviderButton({
    provider: provider.id,
    label,
    icon: provider.icon,
  });
}

export function renderLogin(context, {
  error = "",
} = {}) {
  const providers = getEnabledAuthProviders();
  context.shell.setHeaderContent?.({ title: msg("account.vhod") });
  context.root.innerHTML = panel({
    title: msg("account.akkaunt"),
    classes: "accountPanel",
    viewClasses: "accountView",
    body: `
      <div class="accountStack">
        ${error ? `<div class="accountMessage accountMessageError" role="alert">${escapeHtml(error)}</div>` : ""}
        <div class="authProviderList">
          ${providers.map(renderProvider).join("")}
        </div>
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
  if (googleContainer) void onGoogleMount?.(googleContainer);

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

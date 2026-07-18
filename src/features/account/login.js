import { getEnabledAuthProviders } from "../../config/auth-providers.js?v=13.10.6";
import { preloadSupabaseClient } from "../../shared/auth/supabase-client.js?v=13.10.6";
import { msg } from "../../shared/i18n/index.js?v=13.10.6";
import { renderAuthProviderButton, setAuthProviderButtonState } from "../../shared/ui/auth-provider-button.js?v=13.9.0";
import { escapeHtml } from "../../shared/ui/html.js?v=13.9.0";
import { panel } from "../../shared/ui/panel.js?v=13.9.0";

function renderProvider(provider) {
  return renderAuthProviderButton({
    provider: provider.id,
    label: msg(provider.labelKey),
    icon: provider.icon,
  });
}

export function renderLogin(context, { error = "" } = {}) {
  void preloadSupabaseClient();
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
  onProvider,
  onGuest,
} = {}) {
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

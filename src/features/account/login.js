import { getEnabledAuthProviders } from "../../config/auth-providers.js?v=13.10.7";
import { prepareSignInWithProvider } from "../../shared/auth/auth-service.js?v=13.10.7";
import { preloadSupabaseClient } from "../../shared/auth/supabase-client.js?v=13.10.7";
import { msg } from "../../shared/i18n/index.js?v=13.10.7";
import { renderAuthProviderButton, setAuthProviderButtonState } from "../../shared/ui/auth-provider-button.js?v=13.9.0";
import { escapeHtml } from "../../shared/ui/html.js?v=13.9.0";
import { panel } from "../../shared/ui/panel.js?v=13.9.0";

const PROVIDER_FALLBACK_RESET_MS = 5000;

function renderProvider(provider) {
  return renderAuthProviderButton({
    provider: provider.id,
    label: msg(provider.labelKey),
    icon: provider.icon,
    disabled: true,
  });
}

function prepareProviderButton(root, provider) {
  const button = root.querySelector(`[data-auth-provider="${provider.id}"]`);
  if (!button) return;
  button.dataset.authPreparing = "true";

  void prepareSignInWithProvider(provider.id).then((url) => {
    if (!button.isConnected) return;
    button.dataset.authHref = url;
    button.dataset.authPreparing = "false";
    setAuthProviderButtonState(button, { loading: false, disabled: false });
  }).catch(() => {
    if (!button.isConnected) return;
    button.dataset.authPreparing = "false";
    setAuthProviderButtonState(button, { loading: false, disabled: false });
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
  providers.forEach((provider) => prepareProviderButton(context.root, provider));
}

export function bindLogin(context, signal, {
  onProvider,
  onGuest,
} = {}) {
  context.root.querySelectorAll("[data-auth-provider]").forEach((button) => {
    button.addEventListener("click", async () => {
      const preparedUrl = String(button.dataset.authHref || "").trim();
      if (preparedUrl) {
        window.location.href = preparedUrl;
        return;
      }

      setAuthProviderButtonState(button, { loading: true });
      const resetTimer = globalThis.setTimeout(() => {
        if (button.isConnected) setAuthProviderButtonState(button, { loading: false, disabled: false });
      }, PROVIDER_FALLBACK_RESET_MS);
      try {
        await onProvider?.(button.dataset.authProvider);
      } catch {
        if (button.isConnected) setAuthProviderButtonState(button, { loading: false, disabled: false });
      } finally {
        globalThis.clearTimeout(resetTimer);
      }
    }, { signal });
  });
  context.root.querySelector("#accountContinueGuest")?.addEventListener("click", () => onGuest?.(), { signal });
}

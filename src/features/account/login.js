import { renderAuthProviderButton, setAuthProviderButtonState } from "../../shared/ui/auth-provider-button.js?v=13.6.2";
import { escapeHtml } from "../../shared/ui/html.js";
import { panel } from "../../shared/ui/panel.js?v=13.6.2";

const GOOGLE_ICON = "/assets/icons/auth/google.svg";

export function renderLogin(context, {
  message = "",
  error = "",
  emailExpanded = false,
} = {}) {
  context.shell.setHeaderContent?.({ title: "Вход" });
  context.root.innerHTML = panel({
    title: "Аккаунт",
    classes: "accountPanel",
    viewClasses: "accountView",
    body: `
      <div class="accountStack">
        ${error ? `<div class="accountMessage accountMessageError" role="alert">${escapeHtml(error)}</div>` : ""}
        ${message ? `<div class="accountMessage accountMessageSuccess" role="status">${escapeHtml(message)}</div>` : ""}

        <div class="authProviderList">
          ${renderAuthProviderButton({
            provider: "google",
            label: "Войти через Google",
            icon: GOOGLE_ICON,
          })}
        </div>

        <div class="accountDivider"><span>или</span></div>

        <button id="accountEmailToggle" class="btn ghost accountAction authEmailToggle${emailExpanded ? " hidden" : ""}" type="button">
          <span aria-hidden="true">✉</span>
          <span>Войти по Email</span>
        </button>

        <div id="accountEmailSection" class="authEmailSection${emailExpanded ? " isOpen" : ""}">
          <form id="accountEmailForm" class="accountForm" novalidate>
            <label class="accountField" for="accountEmail">
              <span>Email</span>
              <input id="accountEmail" name="email" type="email" inputmode="email" autocomplete="email" required />
            </label>
            <button class="btn accountAction" type="submit">Получить ссылку для входа</button>
          </form>
        </div>

        <button id="accountContinueGuest" class="btn ghost accountAction" type="button">Продолжить без аккаунта</button>
      </div>`,
  });
}

export function bindLogin(context, signal, {
  onGoogle,
  onEmail,
  onEmailExpand,
  onGuest,
} = {}) {
  const googleButton = context.root.querySelector("[data-auth-provider='google']");
  const emailToggle = context.root.querySelector("#accountEmailToggle");
  const emailSection = context.root.querySelector("#accountEmailSection");
  const emailForm = context.root.querySelector("#accountEmailForm");
  const guestButton = context.root.querySelector("#accountContinueGuest");

  googleButton?.addEventListener("click", async () => {
    setAuthProviderButtonState(googleButton, { loading: true });
    try {
      await onGoogle?.();
    } catch {
      if (googleButton.isConnected) setAuthProviderButtonState(googleButton, { loading: false });
    }
  }, { signal });

  emailToggle?.addEventListener("click", () => {
    emailToggle.classList.add("hidden");
    emailSection?.classList.add("isOpen");
    onEmailExpand?.();
    context.root.querySelector("#accountEmail")?.focus();
  }, { signal });

  emailForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = emailForm.querySelector("button[type='submit']");
    const emailInput = emailForm.querySelector("#accountEmail");
    const originalLabel = submitButton?.textContent || "Получить ссылку для входа";
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Отправляем…";
    }
    try {
      await onEmail?.(emailInput?.value || "");
    } finally {
      if (submitButton?.isConnected) {
        submitButton.disabled = false;
        submitButton.textContent = originalLabel;
      }
    }
  }, { signal });

  guestButton?.addEventListener("click", () => onGuest?.(), { signal });
}

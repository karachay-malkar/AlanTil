import { escapeHtml } from "../../shared/ui/html.js";
import { panel } from "../../shared/ui/panel.js";

export function renderLogin(context, { message = "", error = "" } = {}) {
  context.root.innerHTML = panel({
    title: "Аккаунт",
    classes: "accountPanel",
    body: `
      <div class="accountStack">
        <p class="accountIntro">Вход нужен только для сохранения прогресса в облаке. Приложением можно пользоваться без регистрации.</p>
        ${error ? `<div class="accountMessage accountMessageError" role="alert">${escapeHtml(error)}</div>` : ""}
        ${message ? `<div class="accountMessage accountMessageSuccess" role="status">${escapeHtml(message)}</div>` : ""}

        <button id="accountGoogleLogin" class="btn primary accountAction" type="button">Войти через Google</button>

        <div class="accountDivider"><span>или</span></div>

        <form id="accountEmailForm" class="accountForm" novalidate>
          <label class="accountField" for="accountEmail">
            <span>Электронная почта</span>
            <input id="accountEmail" name="email" type="email" inputmode="email" autocomplete="email" required />
          </label>
          <button class="btn accountAction" type="submit">Получить ссылку для входа</button>
        </form>

        <button id="accountContinueGuest" class="btn ghost accountAction" type="button">Продолжить без аккаунта</button>
      </div>`,
  });
}

export function bindLogin(context, signal, {
  onGoogle,
  onEmail,
  onGuest,
} = {}) {
  const googleButton = context.root.querySelector("#accountGoogleLogin");
  const emailForm = context.root.querySelector("#accountEmailForm");
  const guestButton = context.root.querySelector("#accountContinueGuest");

  googleButton?.addEventListener("click", async () => {
    googleButton.disabled = true;
    try {
      await onGoogle?.();
    } finally {
      googleButton.disabled = false;
    }
  }, { signal });

  emailForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = emailForm.querySelector("button[type='submit']");
    const emailInput = emailForm.querySelector("#accountEmail");
    submitButton.disabled = true;
    try {
      await onEmail?.(emailInput?.value || "");
    } finally {
      submitButton.disabled = false;
    }
  }, { signal });

  guestButton?.addEventListener("click", () => onGuest?.(), { signal });
}

import { escapeHtml } from "../../shared/ui/html.js";
import { panel } from "../../shared/ui/panel.js?v=13.1";

function renderAccountFact(label, value) {
  return `<div class="accountFact"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || "—")}</dd></div>`;
}

export function renderProfileCreation(context, user, {
  nickname = "",
  nicknameMessage = "",
  nicknameState = "",
  error = "",
  unavailable = false,
  submitEnabled = false,
} = {}) {
  const nicknameClass = nicknameState === "available"
    ? " isSuccess"
    : nicknameState === "invalid"
      ? " isError"
      : "";

  context.root.innerHTML = panel({
    title: unavailable ? "Аккаунт" : "Создайте никнейм",
    classes: "accountPanel",
    viewClasses: "accountView",
    body: `
      <div class="accountStack">
        ${error ? `<div class="accountMessage accountMessageError" role="alert">${escapeHtml(error)}</div>` : ""}
        <form id="accountProfileForm" class="accountForm" novalidate>
          <label class="accountField" for="accountProfileEmail">
            <span>Email</span>
            <input id="accountProfileEmail" type="email" value="${escapeHtml(user?.email || "")}" readonly />
          </label>
          <label class="accountField" for="accountNickname">
            <span>Никнейм</span>
            <input id="accountNickname" class="${nicknameClass.trim()}" name="nickname" type="text" minlength="3" maxlength="30" autocomplete="nickname" spellcheck="false" value="${escapeHtml(nickname)}" ${unavailable ? "disabled" : ""} aria-invalid="${nicknameState === "invalid" ? "true" : "false"}" required />
          </label>
          <div id="accountNicknameMessage" class="accountNicknameMessage ${escapeHtml(nicknameState)}" role="status">${escapeHtml(nicknameMessage)}</div>
          <button id="accountCreateProfile" class="btn primary accountAction" type="submit" ${submitEnabled && !unavailable ? "" : "disabled"}>Сохранить</button>
        </form>
        ${unavailable ? `<button id="accountRetryProfile" class="btn accountAction" type="button">Повторить</button>` : ""}
        <button id="accountSignOut" class="btn ghost accountAction" type="button">Выйти</button>
      </div>`,
  });
}

export function bindProfileCreation(context, signal, {
  onNicknameInput,
  onSubmit,
  onRetry,
  onSignOut,
} = {}) {
  const form = context.root.querySelector("#accountProfileForm");
  const nicknameInput = context.root.querySelector("#accountNickname");
  const retryButton = context.root.querySelector("#accountRetryProfile");
  const signOutButton = context.root.querySelector("#accountSignOut");

  nicknameInput?.addEventListener("input", () => {
    onNicknameInput?.(nicknameInput.value, {
      inputElement: nicknameInput,
      messageElement: context.root.querySelector("#accountNicknameMessage"),
      submitButton: context.root.querySelector("#accountCreateProfile"),
    });
  }, { signal });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (nicknameInput?.disabled) return;
    const submitButton = context.root.querySelector("#accountCreateProfile");
    if (submitButton) submitButton.disabled = true;
    await onSubmit?.(nicknameInput?.value || "");
  }, { signal });

  retryButton?.addEventListener("click", async () => {
    retryButton.disabled = true;
    retryButton.textContent = "Проверяем…";
    await onRetry?.();
  }, { signal });

  signOutButton?.addEventListener("click", async () => {
    signOutButton.disabled = true;
    try {
      await onSignOut?.();
    } finally {
      if (signOutButton.isConnected) signOutButton.disabled = false;
    }
  }, { signal });
}

export function renderProfile(context, { user, profile, provider, error = "" }) {
  context.root.innerHTML = panel({
    title: "Аккаунт",
    classes: "accountPanel",
    viewClasses: "accountView",
    body: `
      <div class="accountStack">
        ${error ? `<div class="accountMessage accountMessageError" role="alert">${escapeHtml(error)}</div>` : ""}
        <dl class="accountFacts">
          ${renderAccountFact("Никнейм", profile?.nickname || "")}
          ${renderAccountFact("Email", user?.email || "")}
          ${renderAccountFact("Способ входа", provider || "")}
        </dl>
        <button id="accountSignOut" class="btn ghost accountAction" type="button">Выйти</button>
      </div>`,
  });
}

export function bindProfile(context, signal, { onSignOut } = {}) {
  const signOutButton = context.root.querySelector("#accountSignOut");
  signOutButton?.addEventListener("click", async () => {
    signOutButton.disabled = true;
    try {
      await onSignOut?.();
    } finally {
      if (signOutButton.isConnected) signOutButton.disabled = false;
    }
  }, { signal });
}

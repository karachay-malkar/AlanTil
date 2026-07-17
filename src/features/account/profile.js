import { escapeHtml } from "../../shared/ui/html.js?v=13.8.1";
import { panel } from "../../shared/ui/panel.js?v=13.8.1";

function renderAccountFact(label, value) {
  return `<div class="accountFact"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || "—")}</dd></div>`;
}

function avatarSilhouette() {
  return `<svg viewBox="0 0 64 76" aria-hidden="true" focusable="false"><circle cx="32" cy="22" r="15"/><path d="M9 70c1-20 10-31 23-31s22 11 23 31z"/></svg>`;
}

export function renderAvatarGenderSelection(context, { error = "" } = {}) {
  context.shell.setHeaderContent?.({ title: "Образ аватара" });
  context.root.innerHTML = panel({
    title: "Образ аватара",
    classes: "accountPanel",
    viewClasses: "accountView",
    body: `
      <div class="accountStack accountGenderOnboarding">
        ${error ? `<div class="accountMessage accountMessageError" role="alert">${escapeHtml(error)}</div>` : ""}
        <div class="accountGenderIntro">
          <strong>Выберите пол аватара</strong>
          <span>Это окончательный выбор. Позже изменить его будет нельзя.</span>
        </div>
        <div class="accountGenderChoices" role="group" aria-label="Пол аватара">
          <button class="accountGenderChoice choiceControl" type="button" data-avatar-gender="male">
            <span class="accountGenderFigure">${avatarSilhouette()}</span>
            <span>Мужской</span>
          </button>
          <button class="accountGenderChoice choiceControl" type="button" data-avatar-gender="female">
            <span class="accountGenderFigure">${avatarSilhouette()}</span>
            <span>Женский</span>
          </button>
        </div>
      </div>`,
  });
}

export function bindAvatarGenderSelection(context, signal, { onSelect } = {}) {
  context.root.querySelectorAll("[data-avatar-gender]").forEach((button) => {
    button.addEventListener("click", async () => {
      const buttons = Array.from(context.root.querySelectorAll("[data-avatar-gender]"));
      buttons.forEach((item) => { item.disabled = true; });
      try {
        await onSelect?.(button.dataset.avatarGender);
      } finally {
        buttons.forEach((item) => { if (item.isConnected) item.disabled = false; });
      }
    }, { signal });
  });
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

  const title = unavailable ? "Аккаунт" : "Создайте никнейм";
  context.shell.setHeaderContent?.({ title });
  context.root.innerHTML = panel({
    title,
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
          <button id="accountCreateProfile" class="btn actionPrimary accountAction" type="submit" ${submitEnabled && !unavailable ? "" : "disabled"}>Сохранить</button>
        </form>
        ${unavailable ? `<button id="accountRetryProfile" class="btn actionPrimary accountAction" type="button">Повторить</button>` : ""}
        <button id="accountSignOut" class="btn actionText accountAction" type="button">Выйти</button>
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
  context.shell.setHeaderContent?.({ title: "Аккаунт" });
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
          ${renderAccountFact("Образ аватара", profile?.avatar_gender === "female" ? "Женский" : "Мужской")}
        </dl>
        <button id="accountSignOut" class="btn actionText accountAction" type="button">Выйти</button>
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

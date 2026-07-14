import { escapeHtml } from "../../shared/ui/html.js";
import { panel } from "../../shared/ui/panel.js";

function renderAccountFact(label, value) {
  return `<div class="accountFact"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || "—")}</dd></div>`;
}

export function renderProfileCreation(context, user, {
  nickname = "",
  nicknameMessage = "",
  nicknameState = "",
  error = "",
} = {}) {
  context.root.innerHTML = panel({
    title: "Создайте никнейм",
    classes: "accountPanel",
    body: `
      <div class="accountStack">
        <p class="accountIntro">Выберите уникальный никнейм. Имя и фамилия не требуются.</p>
        <dl class="accountFacts">
          ${renderAccountFact("Email", user?.email || "")}
        </dl>
        ${error ? `<div class="accountMessage accountMessageError" role="alert">${escapeHtml(error)}</div>` : ""}
        <form id="accountProfileForm" class="accountForm" novalidate>
          <label class="accountField" for="accountNickname">
            <span>Никнейм</span>
            <input id="accountNickname" name="nickname" type="text" minlength="3" maxlength="30" autocomplete="nickname" spellcheck="false" value="${escapeHtml(nickname)}" required />
          </label>
          <div id="accountNicknameMessage" class="accountNicknameMessage ${escapeHtml(nicknameState)}" role="status">${escapeHtml(nicknameMessage)}</div>
          <button id="accountCreateProfile" class="btn primary accountAction" type="submit" disabled>Сохранить</button>
        </form>
        <button id="accountSignOut" class="btn ghost accountAction" type="button">Выйти</button>
      </div>`,
  });
}

export function bindProfileCreation(context, signal, {
  onNicknameInput,
  onSubmit,
  onSignOut,
} = {}) {
  const form = context.root.querySelector("#accountProfileForm");
  const nicknameInput = context.root.querySelector("#accountNickname");
  const signOutButton = context.root.querySelector("#accountSignOut");

  nicknameInput?.addEventListener("input", () => {
    onNicknameInput?.(nicknameInput.value, {
      messageElement: context.root.querySelector("#accountNicknameMessage"),
      submitButton: context.root.querySelector("#accountCreateProfile"),
    });
  }, { signal });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = context.root.querySelector("#accountCreateProfile");
    submitButton.disabled = true;
    try {
      await onSubmit?.(nicknameInput?.value || "");
    } finally {
      if (submitButton.isConnected) submitButton.disabled = false;
    }
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
    body: `
      <div class="accountStack">
        ${error ? `<div class="accountMessage accountMessageError" role="alert">${escapeHtml(error)}</div>` : ""}
        <dl class="accountFacts">
          ${renderAccountFact("Никнейм", profile?.nickname || "")}
          ${renderAccountFact("Email", user?.email || "")}
          ${renderAccountFact("Способ входа", provider || "")}
        </dl>
        <p class="accountPrivacyNote">Email виден только вам и не хранится в публичном профиле.</p>
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

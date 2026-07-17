import { msg } from "../../shared/i18n/index.js?v=13.9.0";
import { escapeHtml } from "../../shared/ui/html.js?v=13.9.0";
import { panel } from "../../shared/ui/panel.js?v=13.9.0";

function renderAccountFact(label, value) {
  return `<div class="accountFact"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || "—")}</dd></div>`;
}

function avatarSilhouette() {
  return `<svg viewBox="0 0 64 76" aria-hidden="true" focusable="false"><circle cx="32" cy="22" r="15"/><path d="M9 70c1-20 10-31 23-31s22 11 23 31z"/></svg>`;
}

export function renderAvatarGenderSelection(context, { error = "" } = {}) {
  context.shell.setHeaderContent?.({ title: msg("account.obraz_avatara") });
  context.root.innerHTML = panel({
    title: msg("account.obraz_avatara"),
    classes: "accountPanel",
    viewClasses: "accountView",
    body: `
      <div class="accountStack accountGenderOnboarding">
        ${error ? `<div class="accountMessage accountMessageError" role="alert">${escapeHtml(error)}</div>` : ""}
        <div class="accountGenderIntro">
          <strong>${msg("account.vyberite_pol_avatara")}</strong>
          <span>${msg("account.eto_okonchatelnyy_vybor_pozzhe_izmenit_ego_budet")}</span>
        </div>
        <div class="accountGenderChoices" role="group" aria-label="${msg("account.pol_avatara")}">
          <button class="accountGenderChoice choiceControl" type="button" data-avatar-gender="male">
            <span class="accountGenderFigure">${avatarSilhouette()}</span>
            <span>${msg("account.muzhskoy_2")}</span>
          </button>
          <button class="accountGenderChoice choiceControl" type="button" data-avatar-gender="female">
            <span class="accountGenderFigure">${avatarSilhouette()}</span>
            <span>${msg("account.zhenskiy_2")}</span>
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

  const title = unavailable ? msg("account.akkaunt") : msg("account.sozdayte_nikneym");
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
            <span>${msg("account.nikneym")}</span>
            <input id="accountNickname" class="${nicknameClass.trim()}" name="nickname" type="text" minlength="3" maxlength="30" autocomplete="nickname" spellcheck="false" value="${escapeHtml(nickname)}" ${unavailable ? "disabled" : ""} aria-invalid="${nicknameState === "invalid" ? "true" : "false"}" required />
          </label>
          <div id="accountNicknameMessage" class="accountNicknameMessage ${escapeHtml(nicknameState)}" role="status">${escapeHtml(nicknameMessage)}</div>
          <button id="accountCreateProfile" class="btn actionPrimary accountAction" type="submit" ${submitEnabled && !unavailable ? "" : "disabled"}>${msg("account.sohranit")}</button>
        </form>
        ${unavailable ? `<button id="accountRetryProfile" class="btn actionPrimary accountAction" type="button">${msg("account.povtorit")}</button>` : ""}
        <button id="accountSignOut" class="btn actionText accountAction" type="button">${msg("account.vyyti")}</button>
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
    retryButton.textContent = msg("account.proveryaem");
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
  context.shell.setHeaderContent?.({ title: msg("account.akkaunt") });
  context.root.innerHTML = panel({
    title: msg("account.akkaunt"),
    classes: "accountPanel",
    viewClasses: "accountView",
    body: `
      <div class="accountStack">
        ${error ? `<div class="accountMessage accountMessageError" role="alert">${escapeHtml(error)}</div>` : ""}
        <dl class="accountFacts">
          ${renderAccountFact(msg("account.nikneym"), profile?.nickname || "")}
          ${renderAccountFact("Email", user?.email || "")}
          ${renderAccountFact(msg("account.sposob_vhoda"), provider || "")}
          ${renderAccountFact(msg("account.obraz_avatara"), profile?.avatar_gender === "female" ? msg("account.zhenskiy_2") : msg("account.muzhskoy_2"))}
        </dl>
        <button id="accountSignOut" class="btn actionText accountAction" type="button">${msg("account.vyyti")}</button>
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

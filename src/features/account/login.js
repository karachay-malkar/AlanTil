import { preloadSupabaseClient } from "../../shared/auth/supabase-client.js?v=16.8.0.3";
import { msg } from "../../shared/i18n/index.js?v=16.8.0.3";
import { escapeHtml } from "../../shared/ui/html.js?v=16.8.0.3";
import { panel } from "../../shared/ui/panel.js?v=16.8.0.3";

const LOGIN_MODES = new Set(["signin", "signup", "forgot"]);

function normalizeMode(mode) {
  const value = String(mode || "").trim().toLowerCase();
  return LOGIN_MODES.has(value) ? value : "signin";
}

function titleForMode(mode) {
  if (mode === "signup") return msg("account.sozdat_akkaunt");
  if (mode === "forgot") return msg("account.vosstanovlenie_parolya");
  return msg("account.vhod");
}

function primaryLabel(mode) {
  if (mode === "signup") return msg("account.sozdat_akkaunt");
  if (mode === "forgot") return msg("account.otpravit_ssylku");
  return msg("account.voyti");
}

function renderModeActions(mode) {
  if (mode === "signup") {
    return '<button class="btn actionText accountAction" type="button" data-account-auth-mode="signin">' + escapeHtml(msg("account.uzhe_est_akkaunt_voyti")) + '</button>';
  }
  if (mode === "forgot") {
    return '<button class="btn actionText accountAction" type="button" data-account-auth-mode="signin">' + escapeHtml(msg("account.nazad_ko_vhodu")) + '</button>';
  }
  return '<div class="accountAuthLinks">'
    + '<button class="btn actionText accountAction" type="button" data-account-auth-mode="signup">' + escapeHtml(msg("account.sozdat_akkaunt")) + '</button>'
    + '<button class="btn actionText accountAction" type="button" data-account-auth-mode="forgot">' + escapeHtml(msg("account.zabyli_parol")) + '</button>'
    + '</div>';
}

export function renderLogin(context, {
  error = "",
  message = "",
  mode = "signin",
  email = "",
} = {}) {
  void preloadSupabaseClient();
  const resolvedMode = normalizeMode(mode);
  const title = titleForMode(resolvedMode);
  const needsPassword = resolvedMode !== "forgot";
  const needsConfirmation = resolvedMode === "signup";
  context.shell.setHeaderContent?.({ title: msg("account.vhod") });

  const body = [
    '<div class="accountStack">',
    error ? '<div class="accountMessage accountMessageError" role="alert">' + escapeHtml(error) + '</div>' : "",
    message ? '<div class="accountMessage accountMessageSuccess" role="status">' + escapeHtml(message) + '</div>' : "",
    '<form id="accountLoginForm" class="accountForm" novalidate>',
    '<label class="accountField" for="accountAuthEmail"><span>' + escapeHtml(msg("account.email")) + '</span>',
    '<input id="accountAuthEmail" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" value="' + escapeHtml(email) + '" required /></label>',
    needsPassword
      ? '<label class="accountField" for="accountAuthPassword"><span>' + escapeHtml(msg("account.parol")) + '</span><input id="accountAuthPassword" name="password" type="password" minlength="6" autocomplete="' + (resolvedMode === "signup" ? "new-password" : "current-password") + '" required /></label>'
      : "",
    needsConfirmation
      ? '<label class="accountField" for="accountAuthPasswordConfirm"><span>' + escapeHtml(msg("account.povtorite_parol")) + '</span><input id="accountAuthPasswordConfirm" name="passwordConfirm" type="password" minlength="6" autocomplete="new-password" required /></label>'
      : "",
    '<button id="accountAuthSubmit" class="btn actionPrimary accountAction" type="submit">' + escapeHtml(primaryLabel(resolvedMode)) + '</button>',
    '</form>',
    renderModeActions(resolvedMode),
    '<div class="accountDivider" role="separator"><span>' + escapeHtml(msg("account.ili")) + '</span></div>',
    '<div class="accountLegacyNote">' + escapeHtml(msg("account.legacy_google_note")) + '</div>',
    '<button id="accountLegacyGoogle" class="btn actionText accountAction" type="button">' + escapeHtml(msg("account.ranshe_vhodili_cherez_google")) + '</button>',
    '<button id="accountContinueGuest" class="btn actionText accountAction" type="button">' + escapeHtml(msg("account.prodolzhit_kak_gost")) + '</button>',
    '</div>',
  ].join("");

  context.root.innerHTML = panel({
    title,
    classes: "accountPanel",
    viewClasses: "accountView",
    body,
  });
}

export function bindLogin(context, signal, {
  onSubmit,
  onMode,
  onLegacyGoogle,
  onGuest,
} = {}) {
  const form = context.root.querySelector("#accountLoginForm");
  const emailInput = context.root.querySelector("#accountAuthEmail");
  const renderedMode = normalizeMode(
    context.root.querySelector("#accountAuthPasswordConfirm")
      ? "signup"
      : context.root.querySelector("#accountAuthPassword")
        ? "signin"
        : "forgot",
  );
  if (form) form.dataset.authMode = renderedMode;

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const submitButton = context.root.querySelector("#accountAuthSubmit");
    if (submitButton) submitButton.disabled = true;
    try {
      await onSubmit?.({
        mode: normalizeMode(form.dataset.authMode),
        email: emailInput?.value || "",
        password: context.root.querySelector("#accountAuthPassword")?.value || "",
        passwordConfirm: context.root.querySelector("#accountAuthPasswordConfirm")?.value || "",
      });
    } finally {
      if (submitButton?.isConnected) submitButton.disabled = false;
    }
  }, { signal });

  context.root.querySelectorAll("[data-account-auth-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      onMode?.(button.dataset.accountAuthMode, emailInput?.value || "");
    }, { signal });
  });

  const legacyButton = context.root.querySelector("#accountLegacyGoogle");
  legacyButton?.addEventListener("click", async () => {
    legacyButton.disabled = true;
    try {
      await onLegacyGoogle?.();
    } finally {
      if (legacyButton.isConnected) legacyButton.disabled = false;
    }
  }, { signal });

  context.root.querySelector("#accountContinueGuest")?.addEventListener("click", () => onGuest?.(), { signal });
}

export function renderPasswordSetup(context, {
  flow = "recovery",
  error = "",
  message = "",
} = {}) {
  const legacy = flow === "legacy_google";
  const title = legacy ? msg("account.legacy_google_title") : msg("account.novyy_parol");
  context.shell.setHeaderContent?.({ title: msg("account.akkaunt") });
  context.root.innerHTML = panel({
    title,
    classes: "accountPanel",
    viewClasses: "accountView",
    body: [
      '<div class="accountStack">',
      error ? '<div class="accountMessage accountMessageError" role="alert">' + escapeHtml(error) + '</div>' : "",
      message ? '<div class="accountMessage accountMessageSuccess" role="status">' + escapeHtml(message) + '</div>' : "",
      '<div class="accountIntro">' + escapeHtml(legacy ? msg("account.legacy_google_password_note") : msg("account.recovery_password_note")) + '</div>',
      '<form id="accountPasswordSetupForm" class="accountForm" novalidate>',
      '<label class="accountField" for="accountNewPassword"><span>' + escapeHtml(msg("account.novyy_parol")) + '</span><input id="accountNewPassword" type="password" minlength="6" autocomplete="new-password" required /></label>',
      '<label class="accountField" for="accountNewPasswordConfirm"><span>' + escapeHtml(msg("account.povtorite_parol")) + '</span><input id="accountNewPasswordConfirm" type="password" minlength="6" autocomplete="new-password" required /></label>',
      '<button id="accountSavePassword" class="btn actionPrimary accountAction" type="submit">' + escapeHtml(msg("account.sohranit_parol")) + '</button>',
      '</form>',
      '<button id="accountPasswordSetupSignOut" class="btn actionText accountAction" type="button">' + escapeHtml(msg("account.vyyti")) + '</button>',
      '</div>',
    ].join(""),
  });
}

export function bindPasswordSetup(context, signal, {
  onSubmit,
  onSignOut,
} = {}) {
  const form = context.root.querySelector("#accountPasswordSetupForm");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = context.root.querySelector("#accountSavePassword");
    if (button) button.disabled = true;
    try {
      await onSubmit?.(
        context.root.querySelector("#accountNewPassword")?.value || "",
        context.root.querySelector("#accountNewPasswordConfirm")?.value || "",
      );
    } finally {
      if (button?.isConnected) button.disabled = false;
    }
  }, { signal });

  const signOutButton = context.root.querySelector("#accountPasswordSetupSignOut");
  signOutButton?.addEventListener("click", async () => {
    signOutButton.disabled = true;
    try {
      await onSignOut?.();
    } finally {
      if (signOutButton.isConnected) signOutButton.disabled = false;
    }
  }, { signal });
}

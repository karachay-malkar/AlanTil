import { msg } from "../../shared/i18n/index.js?v=16.8.0.6";
import {
  getCurrentAuthState,
  getUserProvider,
  sendPasswordReset,
  signInWithEmail,
  signInWithLegacyGoogle,
  signOut,
  signUpWithEmail,
  subscribeToAuth,
  updateCurrentUserPassword,
} from "../../shared/auth/auth-service.js?v=16.8.0.6";
import { hasPersistedAuthSession } from "../../shared/auth/supabase-client.js?v=16.8.0.6";
import {
  isProfileServiceUnavailableError,
  SUPABASE_ERROR_KINDS,
} from "../../shared/errors/supabase-error.js?v=16.8.0.6";
import {
  createProfile,
  getProfile,
  isNicknameAvailable,
  updateProfileNickname,
  validateNickname,
} from "../../shared/profile/profile-service.js?v=16.8.0.6";
import { panel } from "../../shared/ui/panel.js?v=16.8.0.6";
import {
  bindLogin,
  bindPasswordSetup,
  renderLogin,
  renderPasswordSetup,
} from "./login.js?v=16.8.0.6";
import {
  bindProfile,
  bindProfileCreation,
  renderProfile,
  renderProfileCreation,
} from "./profile.js?v=16.8.0.6";

let controller = null;
let unsubscribeAuth = null;
let renderRequest = 0;
let nicknameCheckRequest = 0;
let nicknameCheckTimer = 0;
let renderQueued = false;
let actionError = "";
let nicknameValue = "";
let genderValue = "";
let nicknameStatus = { state: "", message: "", available: false };
let profileFailure = null;
let lastAuthUserId = "";
let loginMode = "signin";
let loginEmail = "";
let actionMessage = "";

function isMounted() {
  return Boolean(controller && !controller.signal.aborted);
}

function clearNicknameTimer() {
  if (nicknameCheckTimer) window.clearTimeout(nicknameCheckTimer);
  nicknameCheckTimer = 0;
  nicknameCheckRequest += 1;
}

function resetNicknameState() {
  clearNicknameTimer();
  nicknameValue = "";
  genderValue = "";
  nicknameStatus = { state: "", message: "", available: false };
}

function resetAccountStateForAuthChange() {
  actionError = "";
  actionMessage = "";
  loginMode = "signin";
  loginEmail = "";
  profileFailure = null;
  resetNicknameState();
}

function prepareAccountRender(context) {
  const activeElement = document.activeElement;
  if (activeElement && context.root.contains(activeElement) && typeof activeElement.blur === "function") {
    activeElement.blur();
  }
}

function resetAccountViewport(context) {
  window.requestAnimationFrame(() => {
    if (!isMounted()) return;
    context.root.scrollTop = 0;
    context.root.scrollLeft = 0;
    const view = context.root.querySelector(".accountView");
    const panelBody = context.root.querySelector(".accountPanel .panel-body");
    if (view) {
      view.scrollTop = 0;
      view.scrollLeft = 0;
    }
    if (panelBody) {
      panelBody.scrollTop = 0;
      panelBody.scrollLeft = 0;
    }
    window.scrollTo?.(0, 0);
  });
}

function scheduleAccountRender(context) {
  if (renderQueued || !isMounted()) return;
  renderQueued = true;
  queueMicrotask(() => {
    renderQueued = false;
    if (isMounted()) void renderAccount(context);
  });
}

function renderLoading(context) {
  prepareAccountRender(context);
  context.shell.setHeaderContent?.({ title: msg("account.akkaunt") });
  context.root.innerHTML = panel({
    title: msg("account.akkaunt"),
    classes: "accountPanel",
    viewClasses: "accountView",
    body: `<div class="loadingState">${msg("account.proveryaem_akkaunt")}</div>`,
  });
  resetAccountViewport(context);
}

function updateNicknameState({ inputElement, messageElement, submitButton }, state, message, enabled = false) {
  if (inputElement) {
    inputElement.classList.toggle("isSuccess", state === "available");
    inputElement.classList.toggle("isError", state === "invalid");
    inputElement.setAttribute("aria-invalid", state === "invalid" ? "true" : "false");
  }
  if (messageElement) {
    messageElement.className = `accountNicknameMessage ${state || ""}`.trim();
    messageElement.textContent = message;
  }
  if (submitButton) submitButton.disabled = !enabled;
}

function setProfileFailure(error) {
  clearNicknameTimer();
  profileFailure = error;
  actionError = error?.message || msg("account.ne_udalos_vypolnit_operatsiyu_povtorite_pozzhe");
  nicknameStatus = { state: "", message: "", available: false };
}

async function handleSignOut(context) {
  actionError = "";
  profileFailure = null;
  clearNicknameTimer();
  try {
    await signOut();
  } catch (error) {
    actionError = error.message;
    scheduleAccountRender(context);
  }
}

async function handleRetry(context, userId) {
  const failedKind = profileFailure?.kind || "";
  actionError = "";
  nicknameStatus = { state: "", message: "", available: false };
  renderLoading(context);

  try {
    await getProfile(userId);
    if (failedKind === SUPABASE_ERROR_KINDS.NICKNAME_CHECK_UNAVAILABLE) {
      const validation = validateNickname(nicknameValue);
      await isNicknameAvailable(validation.valid ? validation.nickname : "alantil_check");
    }
    profileFailure = null;
  } catch (error) {
    setProfileFailure(error);
  }
  scheduleAccountRender(context);
}

function renderProfileUnavailable(context, authState) {
  prepareAccountRender(context);
  renderProfileCreation(context, authState.user, {
    nickname: nicknameValue,
    error: actionError || profileFailure?.message || msg("account.ne_udalos_vypolnit_operatsiyu_povtorite_pozzhe"),
    unavailable: true,
  });
  bindProfileCreation(context, controller.signal, {
    onRetry: () => handleRetry(context, authState.user.id),
    onSignOut: () => handleSignOut(context),
  });
  resetAccountViewport(context);
}

async function renderAccount(context) {
  if (!isMounted()) return;
  const requestId = ++renderRequest;
  const authState = getCurrentAuthState();

  if (!authState.ready && hasPersistedAuthSession()) {
    renderLoading(context);
    return;
  }

  if (!authState.user) {
    prepareAccountRender(context);
    renderLogin(context, {
      error: actionError || authState.error || "",
      message: actionMessage,
      mode: loginMode,
      email: loginEmail,
    });
    bindLogin(context, controller.signal, {
      onMode: (mode, email) => {
        loginMode = mode;
        loginEmail = email;
        actionError = "";
        actionMessage = "";
        scheduleAccountRender(context);
      },
      onSubmit: async ({ mode, email, password, passwordConfirm }) => {
        loginEmail = email;
        actionError = "";
        actionMessage = "";
        try {
          if (mode === "signup") {
            if (password !== passwordConfirm) throw new Error(msg("account.paroli_ne_sovpadayut"));
            const data = await signUpWithEmail(email, password);
            if (!data?.session?.user) {
              actionMessage = msg("account.proverte_pochtu_dlya_podtverzhdeniya");
              scheduleAccountRender(context);
            }
            return;
          }
          if (mode === "forgot") {
            await sendPasswordReset(email);
            actionMessage = msg("account.ssylka_dlya_smeny_parolya_otpravlena");
            scheduleAccountRender(context);
            return;
          }
          await signInWithEmail(email, password);
        } catch (error) {
          actionError = error?.message || msg("account.ne_udalos_vypolnit_operatsiyu_povtorite_pozzhe");
          scheduleAccountRender(context);
        }
      },
      onLegacyGoogle: async () => {
        actionError = "";
        actionMessage = "";
        try {
          await signInWithLegacyGoogle();
        } catch (error) {
          actionError = error?.message || msg("account.ne_udalos_vypolnit_operatsiyu_povtorite_pozzhe");
          scheduleAccountRender(context);
        }
      },
      onGuest: () => context.router.replace(
        "path.home",
        { storyType: "roots" },
        { force: true, reason: "home" },
      ),
    });
    resetAccountViewport(context);
    return;
  }

  if (authState.flow === "legacy_google" || authState.flow === "recovery") {
    prepareAccountRender(context);
    renderPasswordSetup(context, {
      flow: authState.flow,
      error: actionError || authState.error || "",
      message: actionMessage,
    });
    bindPasswordSetup(context, controller.signal, {
      onSubmit: async (password, passwordConfirm) => {
        actionError = "";
        actionMessage = "";
        try {
          if (password !== passwordConfirm) throw new Error(msg("account.paroli_ne_sovpadayut"));
          await updateCurrentUserPassword(password);
          actionMessage = msg("account.parol_sohranen");
          await context.router.replace(
            "path.home",
            { storyType: "roots" },
            { force: true, reason: "password_ready" },
          );
        } catch (error) {
          actionError = error?.message || msg("account.ne_udalos_vypolnit_operatsiyu_povtorite_pozzhe");
          scheduleAccountRender(context);
        }
      },
      onSignOut: () => handleSignOut(context),
    });
    resetAccountViewport(context);
    return;
  }

  if (profileFailure) {
    renderProfileUnavailable(context, authState);
    return;
  }

  renderLoading(context);
  let profile = null;
  try {
    profile = await getProfile(authState.user.id);
  } catch (error) {
    if (requestId !== renderRequest || !isMounted()) return;
    setProfileFailure(error);
    renderProfileUnavailable(context, authState);
    return;
  }
  if (requestId !== renderRequest || !isMounted()) return;

  const profileIncomplete = !profile?.nickname || !profile?.avatar_gender;
  if (profileIncomplete) {
    if (!nicknameValue && profile?.nickname) nicknameValue = profile.nickname;
    if (!genderValue && profile?.avatar_gender) genderValue = profile.avatar_gender;
    const initialValidation = validateNickname(nicknameValue);
    if (initialValidation.valid && nicknameValue === profile?.nickname && !nicknameStatus.state) {
      nicknameStatus = { state: "available", message: "", available: true };
    }
    prepareAccountRender(context);
    renderProfileCreation(context, authState.user, {
      nickname: nicknameValue,
      gender: genderValue,
      nicknameMessage: nicknameStatus.message,
      nicknameState: nicknameStatus.state,
      error: actionError || authState.error || "",
      submitEnabled: initialValidation.valid && nicknameStatus.available && Boolean(genderValue),
      title: profile?.nickname ? msg("account.vyberite_pol_avatara") : msg("account.sozdayte_nikneym"),
    });
    bindProfileCreation(context, controller.signal, {
      onNicknameInput: (value, elements) => {
        nicknameValue = value;
        actionError = "";
        clearNicknameTimer();
        const validation = validateNickname(value);
        if (!validation.valid) {
          nicknameStatus = { state: "invalid", message: validation.message, available: false };
          updateNicknameState(elements, nicknameStatus.state, nicknameStatus.message, false);
          return;
        }
        nicknameStatus = { state: "checking", message: msg("account.proveryaem_nikneym"), available: false };
        updateNicknameState(elements, nicknameStatus.state, nicknameStatus.message, false);
        const checkId = nicknameCheckRequest;
        nicknameCheckTimer = window.setTimeout(async () => {
          nicknameCheckTimer = 0;
          if (checkId !== nicknameCheckRequest || !isMounted() || profileFailure) return;
          try {
            const result = await isNicknameAvailable(value);
            if (checkId !== nicknameCheckRequest || !isMounted() || profileFailure) return;
            nicknameStatus = {
              state: result.available ? "available" : "invalid",
              message: result.message,
              available: result.available,
            };
            updateNicknameState(elements, nicknameStatus.state, nicknameStatus.message, nicknameStatus.available && Boolean(genderValue));
          } catch (error) {
            if (!isMounted()) return;
            if (isProfileServiceUnavailableError(error)) {
              setProfileFailure(error);
              scheduleAccountRender(context);
              return;
            }
            nicknameStatus = { state: "invalid", message: error.message, available: false };
            updateNicknameState(elements, nicknameStatus.state, nicknameStatus.message, false);
          }
        }, 350);
      },
      onGenderChange: (value, elements) => {
        genderValue = value;
        if (elements.submitButton) elements.submitButton.disabled = !(nicknameStatus.available && Boolean(genderValue));
      },
      onSubmit: async ({ nickname, gender }) => {
        actionError = "";
        nicknameValue = nickname;
        genderValue = gender;
        clearNicknameTimer();
        try {
          const availability = await isNicknameAvailable(nickname);
          if (!availability.available) {
            nicknameStatus = { state: "invalid", message: availability.message, available: false };
            scheduleAccountRender(context);
            return;
          }
          await createProfile(authState.user.id, nickname, gender);
          profileFailure = null;
          resetNicknameState();
        } catch (error) {
          if (isProfileServiceUnavailableError(error)) setProfileFailure(error);
          else {
            actionError = "";
            nicknameStatus = { state: "invalid", message: error.message, available: false };
          }
        }
        scheduleAccountRender(context);
      },
      onRetry: () => handleRetry(context, authState.user.id),
      onSignOut: () => handleSignOut(context),
    });
    resetAccountViewport(context);
    return;
  }

  actionError = "";
  profileFailure = null;
  if (!nicknameValue) nicknameValue = profile.nickname || "";
  if (nicknameValue === profile.nickname && !nicknameStatus.state) {
    nicknameStatus = { state: "available", message: "", available: true };
  }
  prepareAccountRender(context);
  renderProfile(context, {
    user: authState.user,
    profile,
    provider: getUserProvider(authState.user),
    error: authState.error || "",
    nickname: nicknameValue,
    nicknameMessage: nicknameStatus.message,
    nicknameState: nicknameStatus.state,
    submitEnabled: nicknameStatus.available && nicknameValue !== profile.nickname,
  });
  bindProfile(context, controller.signal, {
    onNicknameInput: (value, elements) => {
      nicknameValue = value;
      clearNicknameTimer();
      const validation = validateNickname(value);
      if (!validation.valid) {
        nicknameStatus = { state: "invalid", message: validation.message, available: false };
        updateNicknameState(elements, nicknameStatus.state, nicknameStatus.message, false);
        return;
      }
      nicknameStatus = { state: "checking", message: msg("account.proveryaem_nikneym"), available: false };
      updateNicknameState(elements, nicknameStatus.state, nicknameStatus.message, false);
      const checkId = nicknameCheckRequest;
      nicknameCheckTimer = window.setTimeout(async () => {
        nicknameCheckTimer = 0;
        if (checkId !== nicknameCheckRequest || !isMounted()) return;
        try {
          const result = await isNicknameAvailable(value);
          if (checkId !== nicknameCheckRequest || !isMounted()) return;
          nicknameStatus = { state: result.available ? "available" : "invalid", message: result.message, available: result.available };
          updateNicknameState(elements, nicknameStatus.state, nicknameStatus.message, result.available && value !== profile.nickname);
        } catch (error) {
          nicknameStatus = { state: "invalid", message: error?.message || msg("account.ne_udalos_vypolnit_operatsiyu_povtorite_pozzhe"), available: false };
          updateNicknameState(elements, nicknameStatus.state, nicknameStatus.message, false);
        }
      }, 350);
    },
    onNicknameSubmit: async (nickname) => {
      clearNicknameTimer();
      try {
        const availability = await isNicknameAvailable(nickname);
        if (!availability.available) {
          nicknameStatus = { state: "invalid", message: availability.message, available: false };
        } else {
          await updateProfileNickname(authState.user.id, nickname);
          resetNicknameState();
        }
      } catch (error) {
        nicknameStatus = { state: "invalid", message: error?.message || msg("account.ne_udalos_vypolnit_operatsiyu_povtorite_pozzhe"), available: false };
      }
      scheduleAccountRender(context);
    },
    onSignOut: () => handleSignOut(context),
  });
  resetAccountViewport(context);
}

export async function mount(context) {
  controller = new AbortController();
  renderQueued = false;
  lastAuthUserId = getCurrentAuthState().user?.id || "";
  resetAccountStateForAuthChange();

  unsubscribeAuth = subscribeToAuth((state) => {
    const previousUserId = lastAuthUserId;
    const nextUserId = state.user?.id || "";
    if (nextUserId !== previousUserId) {
      lastAuthUserId = nextUserId;
      resetAccountStateForAuthChange();
    }
    if (!previousUserId && nextUserId) {
      if (state.flow === "legacy_google" || state.flow === "recovery") {
        scheduleAccountRender(context);
        return;
      }
      void context.router.replace(
        "path.home",
        { storyType: "roots" },
        { force: true, reason: "auth_success" },
      );
      return;
    }
    scheduleAccountRender(context);
  });

  await renderAccount(context);
}

export function unmount() {
  controller?.abort();
  unsubscribeAuth?.();
  unsubscribeAuth = null;
  controller = null;
  renderQueued = false;
  renderRequest += 1;
  clearNicknameTimer();
}

export function canLeave() {
  return true;
}

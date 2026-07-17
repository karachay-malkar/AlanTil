import { msg } from "../../shared/i18n/index.js?v=13.10.2";
import {
  getCurrentAuthState,
  getUserProvider,
  signInWithGoogleCredential,
  signInWithProvider,
  signOut,
  subscribeToAuth,
} from "../../shared/auth/auth-service.js?v=13.10.2";
import { renderGoogleIdentityButton } from "../../shared/auth/google-identity.js?v=13.10.2";
import { hasPersistedAuthSession } from "../../shared/auth/supabase-client.js?v=13.10.2";
import {
  isProfileServiceUnavailableError,
  SUPABASE_ERROR_KINDS,
} from "../../shared/errors/supabase-error.js?v=13.9.0";
import {
  createProfile,
  getProfile,
  isNicknameAvailable,
  setAvatarGender,
  validateNickname,
} from "../../shared/profile/profile-service.js?v=13.9.0";
import { panel } from "../../shared/ui/panel.js?v=13.9.0";
import { bindLogin, renderLogin } from "./login.js?v=13.10.2";
import {
  bindAvatarGenderSelection,
  bindProfile,
  bindProfileCreation,
  renderAvatarGenderSelection,
  renderProfile,
  renderProfileCreation,
} from "./profile.js?v=13.9.0";

let controller = null;
let unsubscribeAuth = null;
let renderRequest = 0;
let nicknameCheckRequest = 0;
let nicknameCheckTimer = 0;
let renderQueued = false;
let actionError = "";
let nicknameValue = "";
let nicknameStatus = { state: "", message: "", available: false };
let profileFailure = null;
let lastAuthUserId = "";
let disposeGoogleIdentity = null;

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
  nicknameStatus = { state: "", message: "", available: false };
}

function resetAccountStateForAuthChange() {
  actionError = "";
  profileFailure = null;
  resetNicknameState();
}

function prepareAccountRender(context) {
  disposeGoogleIdentity?.();
  disposeGoogleIdentity = null;
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

function showInlineLoginError(context, error) {
  if (!isMounted()) return;
  const message = String(error?.message || error || msg("account.ne_udalos_vypolnit_operatsiyu_povtorite_pozzhe"));
  actionError = message;
  let element = context.root.querySelector(".accountMessageError");
  if (!element) {
    element = document.createElement("div");
    element.className = "accountMessage accountMessageError";
    element.setAttribute("role", "alert");
    context.root.querySelector(".authProviderList")?.before(element);
  }
  element.textContent = message;
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
    renderLogin(context, { error: actionError || authState.error || "" });
    bindLogin(context, controller.signal, {
      onGoogleMount: (container) => {
        disposeGoogleIdentity?.();
        disposeGoogleIdentity = renderGoogleIdentityButton(container, {
          onCredential: async ({ credential, nonce }) => {
            actionError = "";
            await signInWithGoogleCredential(credential, nonce);
          },
          onError: (error) => showInlineLoginError(context, error),
        });
      },
      onProvider: async (provider) => {
        actionError = "";
        try {
          await signInWithProvider(provider);
        } catch (error) {
          showInlineLoginError(context, error);
          throw error;
        }
      },
      onGuest: () => context.router.replace(
        "path.home",
        { storyType: "ascent" },
        { force: true, reason: "home" },
      ),
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

  if (!profile) {
    prepareAccountRender(context);
    renderProfileCreation(context, authState.user, {
      nickname: nicknameValue,
      nicknameMessage: nicknameStatus.message,
      nicknameState: nicknameStatus.state,
      error: actionError || authState.error || "",
      submitEnabled: nicknameStatus.available,
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
            updateNicknameState(elements, nicknameStatus.state, nicknameStatus.message, nicknameStatus.available);
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
      onSubmit: async (nickname) => {
        actionError = "";
        nicknameValue = nickname;
        clearNicknameTimer();
        try {
          const availability = await isNicknameAvailable(nickname);
          if (!availability.available) {
            nicknameStatus = { state: "invalid", message: availability.message, available: false };
            actionError = "";
            scheduleAccountRender(context);
            return;
          }
          await createProfile(authState.user.id, nickname);
          profileFailure = null;
          resetNicknameState();
        } catch (error) {
          if (isProfileServiceUnavailableError(error)) {
            setProfileFailure(error);
          } else {
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

  if (!profile.avatar_gender) {
    prepareAccountRender(context);
    renderAvatarGenderSelection(context, { error: actionError || authState.error || "" });
    bindAvatarGenderSelection(context, controller.signal, {
      onSelect: async (gender) => {
        const label = gender === "female" ? msg("account.zhenskiy") : msg("account.muzhskoy");
        const confirmed = await context.modal.confirm({
          message: msg("account.vybrat_obraz_posle_sohraneniya_izmenit_vybor_budet", { label }).replace("\n", "<br>"),
        });
        if (!confirmed) return;
        actionError = "";
        try {
          await setAvatarGender(authState.user.id, gender);
        } catch (error) {
          actionError = error.message;
        }
        scheduleAccountRender(context);
      },
    });
    resetAccountViewport(context);
    return;
  }

  actionError = "";
  profileFailure = null;
  resetNicknameState();
  prepareAccountRender(context);
  renderProfile(context, {
    user: authState.user,
    profile,
    provider: getUserProvider(authState.user),
    error: authState.error || "",
  });
  bindProfile(context, controller.signal, {
    onSignOut: () => handleSignOut(context),
  });
  resetAccountViewport(context);
}

export async function mount(context) {
  context.ensureStyle("/src/features/account/account.css?v=13.10.2", "account-feature-style");
  controller = new AbortController();
  renderQueued = false;
  lastAuthUserId = getCurrentAuthState().user?.id || "";
  resetAccountStateForAuthChange();

  unsubscribeAuth = subscribeToAuth((state) => {
    const nextUserId = state.user?.id || "";
    if (nextUserId !== lastAuthUserId) {
      lastAuthUserId = nextUserId;
      resetAccountStateForAuthChange();
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
  disposeGoogleIdentity?.();
  disposeGoogleIdentity = null;
}

export function canLeave() {
  return true;
}

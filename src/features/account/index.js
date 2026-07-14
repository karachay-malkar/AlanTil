import {
  getCurrentAuthState,
  getUserProvider,
  initializeAuth,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  subscribeToAuth,
} from "../../shared/auth/auth-service.js?v=13.1";
import {
  isProfileServiceUnavailableError,
  SUPABASE_ERROR_KINDS,
} from "../../shared/errors/supabase-error.js?v=13.1";
import {
  createProfile,
  getProfile,
  isNicknameAvailable,
  validateNickname,
} from "../../shared/profile/profile-service.js?v=13.1";
import { panel } from "../../shared/ui/panel.js?v=13.1";
import { bindLogin, renderLogin } from "./login.js";
import {
  bindProfile,
  bindProfileCreation,
  renderProfile,
  renderProfileCreation,
} from "./profile.js";

let controller = null;
let unsubscribeAuth = null;
let renderRequest = 0;
let nicknameCheckRequest = 0;
let nicknameCheckTimer = 0;
let renderQueued = false;
let actionError = "";
let loginMessage = "";
let emailExpanded = false;
let nicknameValue = "";
let nicknameStatus = { state: "", message: "", available: false };
let profileFailure = null;
let lastAuthUserId = "";

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
  loginMessage = "";
  emailExpanded = false;
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
  context.root.innerHTML = panel({
    title: "Аккаунт",
    classes: "accountPanel",
    viewClasses: "accountView",
    body: `<div class="loadingState">Проверяем аккаунт…</div>`,
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
  actionError = error?.message || "Не удалось выполнить операцию. Повторите позже.";
  nicknameStatus = { state: "", message: "", available: false };
}

async function handleSignOut(context) {
  actionError = "";
  loginMessage = "";
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
    error: actionError || profileFailure?.message || "Не удалось выполнить операцию. Повторите позже.",
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

  if (!authState.ready) {
    renderLoading(context);
    return;
  }

  if (!authState.user) {
    prepareAccountRender(context);
    renderLogin(context, {
      message: loginMessage,
      error: actionError || authState.error || "",
      emailExpanded,
    });
    bindLogin(context, controller.signal, {
      onGoogle: async () => {
        actionError = "";
        loginMessage = "";
        try {
          await signInWithGoogle();
        } catch (error) {
          actionError = error.message;
          scheduleAccountRender(context);
          throw error;
        }
      },
      onEmail: async (email) => {
        actionError = "";
        loginMessage = "";
        emailExpanded = true;
        try {
          await signInWithEmail(email);
          loginMessage = "Ссылка для входа отправлена. Откройте письмо на этом устройстве.";
        } catch (error) {
          actionError = error.message;
        }
        scheduleAccountRender(context);
      },
      onEmailExpand: () => {
        emailExpanded = true;
      },
      onGuest: () => context.router.navigate("home"),
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

        nicknameStatus = { state: "checking", message: "Проверяем никнейм…", available: false };
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
  context.ensureStyle("/src/features/account/account.css?v=13.1", "account-feature-style");
  controller = new AbortController();
  renderQueued = false;
  lastAuthUserId = getCurrentAuthState().user?.id || "";
  resetAccountStateForAuthChange();
  renderLoading(context);

  try {
    await initializeAuth();
  } catch (error) {
    actionError = error.message;
  }
  if (!isMounted()) return;

  lastAuthUserId = getCurrentAuthState().user?.id || "";
  unsubscribeAuth = subscribeToAuth((state) => {
    const nextUserId = state.user?.id || "";
    if (nextUserId !== lastAuthUserId) {
      lastAuthUserId = nextUserId;
      resetAccountStateForAuthChange();
    }
    scheduleAccountRender(context);
  });
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

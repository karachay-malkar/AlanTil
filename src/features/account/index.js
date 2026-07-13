import {
  getCurrentAuthState,
  getUserProvider,
  initializeAuth,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  subscribeToAuth,
} from "../../shared/auth/auth-service.js";
import {
  createProfile,
  getProfile,
  isNicknameAvailable,
  validateNickname,
} from "../../shared/profile/profile-service.js";
import { panel } from "../../shared/ui/panel.js";
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
let actionError = "";
let loginMessage = "";

function renderLoading(context) {
  context.root.innerHTML = panel({
    title: "Аккаунт",
    classes: "accountPanel",
    body: `<div class="loadingState">Проверяем аккаунт…</div>`,
  });
}

function updateNicknameState({ messageElement, submitButton }, state, message, enabled = false) {
  if (messageElement) {
    messageElement.className = `accountNicknameMessage ${state || ""}`.trim();
    messageElement.textContent = message;
  }
  if (submitButton) submitButton.disabled = !enabled;
}

async function renderAccount(context) {
  const requestId = ++renderRequest;
  const authState = getCurrentAuthState();
  if (!authState.ready) {
    renderLoading(context);
    return;
  }

  if (!authState.user) {
    renderLogin(context, {
      message: loginMessage,
      error: actionError || authState.error || "",
    });
    bindLogin(context, controller.signal, {
      onGoogle: async () => {
        actionError = "";
        loginMessage = "";
        try {
          await signInWithGoogle();
        } catch (error) {
          actionError = error.message;
          await renderAccount(context);
        }
      },
      onEmail: async (email) => {
        actionError = "";
        loginMessage = "";
        try {
          await signInWithEmail(email);
          loginMessage = "Ссылка для входа отправлена. Откройте письмо на этом устройстве.";
        } catch (error) {
          actionError = error.message;
        }
        await renderAccount(context);
      },
      onGuest: () => context.router.navigate("home"),
    });
    return;
  }

  renderLoading(context);
  let profile = null;
  try {
    profile = await getProfile(authState.user.id);
  } catch (error) {
    actionError = error.message;
  }
  if (requestId !== renderRequest || controller.signal.aborted) return;

  if (!profile) {
    renderProfileCreation(context, authState.user, { error: actionError });
    bindProfileCreation(context, controller.signal, {
      onNicknameInput: (value, elements) => {
        const validation = validateNickname(value);
        const checkId = ++nicknameCheckRequest;
        if (!validation.valid) {
          updateNicknameState(elements, "invalid", validation.message, false);
          return;
        }

        updateNicknameState(elements, "checking", "Проверяем никнейм…", false);
        window.setTimeout(async () => {
          if (checkId !== nicknameCheckRequest || controller.signal.aborted) return;
          try {
            const result = await isNicknameAvailable(value);
            if (checkId !== nicknameCheckRequest || controller.signal.aborted) return;
            updateNicknameState(
              elements,
              result.available ? "available" : "invalid",
              result.message,
              result.available,
            );
          } catch (error) {
            updateNicknameState(elements, "invalid", error.message, false);
          }
        }, 350);
      },
      onSubmit: async (nickname) => {
        actionError = "";
        try {
          const availability = await isNicknameAvailable(nickname);
          if (!availability.available) throw new Error(availability.message);
          await createProfile(authState.user.id, nickname);
        } catch (error) {
          actionError = error.message;
        }
        await renderAccount(context);
      },
      onSignOut: async () => {
        actionError = "";
        await signOut();
      },
    });
    return;
  }

  actionError = "";
  renderProfile(context, {
    user: authState.user,
    profile,
    provider: getUserProvider(authState.user),
    error: "",
  });
  bindProfile(context, controller.signal, {
    onSignOut: async () => {
      try {
        await signOut();
      } catch (error) {
        actionError = error.message;
        await renderAccount(context);
      }
    },
  });
}

export async function mount(context) {
  context.ensureStyle("/src/features/account/account.css?v=12.2", "account-feature-style");
  controller = new AbortController();
  actionError = "";
  loginMessage = "";
  renderLoading(context);

  try {
    await initializeAuth();
  } catch (error) {
    actionError = error.message;
  }
  if (controller.signal.aborted) return;

  unsubscribeAuth = subscribeToAuth(() => {
    if (!controller?.signal.aborted) void renderAccount(context);
  });
}

export function unmount() {
  controller?.abort();
  controller = null;
  unsubscribeAuth?.();
  unsubscribeAuth = null;
  renderRequest += 1;
  nicknameCheckRequest += 1;
}

export function canLeave() {
  return true;
}

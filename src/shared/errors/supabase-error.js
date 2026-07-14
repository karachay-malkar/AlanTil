const EMAIL_PATTERN = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const LONG_TOKEN_PATTERN = /\b[A-Za-z0-9_-]{48,}\b/g;

export const SUPABASE_ERROR_KINDS = Object.freeze({
  PROFILE_SCHEMA_UNAVAILABLE: "profile_schema_unavailable",
  NICKNAME_CHECK_UNAVAILABLE: "nickname_check_unavailable",
  DUPLICATE_NICKNAME: "duplicate_nickname",
  ACCESS_DENIED: "access_denied",
  NETWORK: "network",
  UNKNOWN: "unknown",
});

export class SupabaseUserError extends Error {
  constructor(message, {
    kind = SUPABASE_ERROR_KINDS.UNKNOWN,
    code = "",
    retryable = true,
    blocksProfileForm = true,
    cause = null,
  } = {}) {
    super(message);
    if (cause) this.cause = cause;
    this.name = "SupabaseUserError";
    this.kind = kind;
    this.code = code;
    this.retryable = retryable;
    this.blocksProfileForm = blocksProfileForm;
  }
}

function rawErrorMessage(error) {
  return String(error?.message || error?.details || error || "").trim();
}

function diagnosticMessage(error) {
  return rawErrorMessage(error)
    .replace(EMAIL_PATTERN, "[email]")
    .replace(JWT_PATTERN, "[token]")
    .replace(LONG_TOKEN_PATTERN, "[token]")
    .slice(0, 500);
}

function errorCode(error) {
  return String(error?.code || error?.status || "").trim();
}

export function logSupabaseError(scope, error) {
  console.error(`[Supabase:${String(scope || "unknown")}]`, {
    code: errorCode(error) || "unknown",
    message: diagnosticMessage(error) || "No diagnostic message",
  });
}

export function normalizeSupabaseError(error, { operation = "profile" } = {}) {
  if (error instanceof SupabaseUserError) return error;

  const code = errorCode(error);
  const message = rawErrorMessage(error);
  const normalizedOperation = String(operation || "profile").toLowerCase();

  const missingProfileTable = code === "PGRST205"
    || /could not find the table[^\n]*profiles|relation[^\n]*profiles[^\n]*does not exist|schema cache[^\n]*profiles/i.test(message);
  if (missingProfileTable) {
    return new SupabaseUserError("Профили пользователей пока недоступны. Попробуйте позже.", {
      kind: SUPABASE_ERROR_KINDS.PROFILE_SCHEMA_UNAVAILABLE,
      code,
      retryable: true,
      blocksProfileForm: true,
      cause: error,
    });
  }

  const missingNicknameFunction = code === "PGRST202"
    || /could not find the function[^\n]*is_nickname_available|function[^\n]*is_nickname_available[^\n]*does not exist|schema cache[^\n]*is_nickname_available/i.test(message);
  if (missingNicknameFunction || (normalizedOperation === "nickname_check" && /function[^\n]*not found/i.test(message))) {
    return new SupabaseUserError("Проверка никнейма временно недоступна.", {
      kind: SUPABASE_ERROR_KINDS.NICKNAME_CHECK_UNAVAILABLE,
      code,
      retryable: true,
      blocksProfileForm: true,
      cause: error,
    });
  }

  if (code === "23505" || /duplicate key|unique constraint/i.test(message)) {
    return new SupabaseUserError("Такой никнейм уже используется.", {
      kind: SUPABASE_ERROR_KINDS.DUPLICATE_NICKNAME,
      code,
      retryable: false,
      blocksProfileForm: false,
      cause: error,
    });
  }

  if (code === "42501" || /row-level security|permission denied|not authorized|jwt.*expired/i.test(message)) {
    return new SupabaseUserError("Не удалось получить доступ к профилю. Войдите заново.", {
      kind: SUPABASE_ERROR_KINDS.ACCESS_DENIED,
      code,
      retryable: true,
      blocksProfileForm: true,
      cause: error,
    });
  }

  if (/network|failed to fetch|fetch failed|load failed|connection|offline|timeout/i.test(message)) {
    return new SupabaseUserError("Не удалось связаться с сервисом профилей.", {
      kind: SUPABASE_ERROR_KINDS.NETWORK,
      code,
      retryable: true,
      blocksProfileForm: true,
      cause: error,
    });
  }

  return new SupabaseUserError("Не удалось выполнить операцию. Повторите позже.", {
    kind: SUPABASE_ERROR_KINDS.UNKNOWN,
    code,
    retryable: true,
    blocksProfileForm: true,
    cause: error,
  });
}

export function isProfileServiceUnavailableError(error) {
  return Boolean(error?.blocksProfileForm);
}

export const AUTH_CALLBACK_KEYS = Object.freeze([
  "code",
  "error",
  "error_code",
  "error_description",
  "sb_flow_id",
]);

export const OAUTH_PROVIDERS = Object.freeze(["google", "apple"]);
const OAUTH_PROVIDER_SET = new Set(OAUTH_PROVIDERS);

function queryValue(source, key) {
  if (!source) return "";
  if (typeof source.get === "function") return String(source.get(key) ?? "").trim();
  const raw = source[key];
  if (Array.isArray(raw)) return String(raw[0] ?? "").trim();
  return String(raw ?? "").trim();
}

export function readAuthCallback(source) {
  const code = queryValue(source, "code");
  const errorDescription = queryValue(source, "error_description");
  const error = errorDescription || queryValue(source, "error");
  const errorCode = queryValue(source, "error_code");
  const flowId = queryValue(source, "sb_flow_id");
  const present = AUTH_CALLBACK_KEYS.some((key) => Boolean(queryValue(source, key)));
  return { code, error, errorCode, flowId, present };
}

export function normalizeOAuthProvider(provider) {
  const normalized = String(provider ?? "").trim().toLowerCase();
  return OAUTH_PROVIDER_SET.has(normalized) ? normalized : "";
}

export function sameAuthUser(left, right) {
  if (left === right) return true;
  if (!left || !right) return false;
  return left.id === right.id
    && left.email === right.email
    && left.app_metadata?.provider === right.app_metadata?.provider;
}

export function sameAuthSession(left, right) {
  if (left === right) return true;
  if (!left || !right) return false;
  return left.access_token === right.access_token
    && left.refresh_token === right.refresh_token
    && left.expires_at === right.expires_at
    && left.user?.id === right.user?.id;
}

export function sameAuthState(left, right) {
  return left.ready === right.ready
    && left.error === right.error
    && sameAuthSession(left.session, right.session)
    && sameAuthUser(left.user, right.user);
}

export function authProviderCode(user) {
  return normalizeOAuthProvider(user?.app_metadata?.provider);
}

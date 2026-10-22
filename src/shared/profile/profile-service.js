import { msg } from "../i18n/index.js?v=16.8.0.7";
import { getSupabaseClient } from "../auth/supabase-client.js?v=16.8.0.7";
import {
  logSupabaseError,
  normalizeSupabaseError,
} from "../errors/supabase-error.js?v=16.8.0.7";
import {
  normalizeNickname,
  validateNicknameRule,
} from "../../../packages/alantil-core/profile.js?v=16.8.0.7";

const PROFILE_REQUEST_TIMEOUT_MS = 12000;
const PROFILE_COLUMNS = "user_id,nickname,avatar_gender,created_at,updated_at";
const PROFILE_VIEW_CACHE_PREFIX = "alantil_profile_display_v1:";
const PROFILE_VIEW_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function getCachedProfile(userId) {
  if (!userId) return null;
  try {
    const value = JSON.parse(localStorage.getItem(PROFILE_VIEW_CACHE_PREFIX + userId) || "null");
    if (value?.user_id !== userId || !value.nickname || Date.now() - Number(value.saved_at) > PROFILE_VIEW_CACHE_MAX_AGE_MS) return null;
    return { user_id: userId, nickname: value.nickname };
  } catch { return null; }
}
function rememberProfile(profile) {
  if (!profile?.user_id || !profile?.nickname) return;
  try {
    localStorage.setItem(PROFILE_VIEW_CACHE_PREFIX + profile.user_id, JSON.stringify({
      user_id: profile.user_id, nickname: profile.nickname, saved_at: Date.now(),
    }));
  } catch { /* Storage may be unavailable or full. */ }
}

function throwProfileError(scope, error, operation) {
  logSupabaseError(scope, error);
  throw normalizeSupabaseError(error, { operation });
}

function withProfileTimeout(value, label) {
  let timer = 0;
  return Promise.race([
    Promise.resolve(value),
    new Promise((_, reject) => {
      timer = globalThis.setTimeout(() => {
        const error = new Error(`${label} timeout`);
        error.code = "ALANTIL_TIMEOUT";
        reject(error);
      }, PROFILE_REQUEST_TIMEOUT_MS);
    }),
  ]).finally(() => globalThis.clearTimeout(timer));
}

export { normalizeNickname };

export function validateNickname(value) {
  const validation = validateNicknameRule(value);
  if (!validation.valid) {
    return {
      valid: false,
      nickname: validation.nickname,
      message: validation.reason === "required" ? msg("service.vvedite_nikneym") : msg("service.nickname_requirements"),
    };
  }
  return { valid: true, nickname: validation.nickname, message: "" };
}

export async function getProfile(userId) {
  if (!userId) return null;
  const client = await getSupabaseClient();
  const { data, error } = await withProfileTimeout(client
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle(), "Profile load");
  if (error) throwProfileError("get_profile", error, "get_profile");
  rememberProfile(data);
  return data || null;
}

export async function isNicknameAvailable(value) {
  const validation = validateNickname(value);
  if (!validation.valid) return { ...validation, available: false };
  const client = await getSupabaseClient();
  const { data, error } = await withProfileTimeout(client.rpc("is_nickname_available", {
    candidate: validation.nickname,
  }), "Nickname check");
  if (error) throwProfileError("check_nickname", error, "nickname_check");
  return {
    ...validation,
    available: Boolean(data),
    message: data ? msg("service.nikneym_svoboden") : msg("service.takoy_nikneym_uzhe_ispolzuetsya"),
  };
}

export async function createProfile(userId, value) {
  const validation = validateNickname(value);
  if (!validation.valid) throw new Error(validation.message);
  if (!userId) throw new Error(msg("service.polzovatel_ne_avtorizovan"));
  const client = await getSupabaseClient();
  let result = await withProfileTimeout(client
    .from("profiles")
    .update({ nickname: validation.nickname })
    .eq("user_id", userId)
    .select(PROFILE_COLUMNS)
    .maybeSingle(), "Profile save");
  if (result?.error) throwProfileError("create_profile", result.error, "create_profile");
  if (result?.data) { rememberProfile(result.data); return result.data; }
  result = await withProfileTimeout(client
    .from("profiles")
    .insert({ user_id: userId, nickname: validation.nickname })
    .select(PROFILE_COLUMNS)
    .single(), "Profile create");
  if (result?.error) throwProfileError("create_profile", result.error, "create_profile");
  rememberProfile(result.data);
  return result.data;
}

export async function updateProfileNickname(userId, value) {
  const validation = validateNickname(value);
  if (!validation.valid) throw new Error(validation.message);
  if (!userId) throw new Error(msg("service.polzovatel_ne_avtorizovan"));
  const client = await getSupabaseClient();
  const { data, error } = await withProfileTimeout(client
    .from("profiles")
    .update({ nickname: validation.nickname })
    .eq("user_id", userId)
    .select(PROFILE_COLUMNS)
    .single(), "Profile nickname update");
  if (error) throwProfileError("update_profile", error, "update_profile");
  rememberProfile(data);
  return data;
}

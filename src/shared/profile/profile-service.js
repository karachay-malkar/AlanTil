import { msg } from "../i18n/index.js?v=16.8.0.3";
import { getSupabaseClient } from "../auth/supabase-client.js?v=16.8.0.3";
import {
  logSupabaseError,
  normalizeSupabaseError,
} from "../errors/supabase-error.js?v=16.8.0.3";
import {
  normalizeNickname,
  validateNicknameRule,
} from "../../../packages/alantil-core/profile.js";

const PROFILE_REQUEST_TIMEOUT_MS = 12000;

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
    .select("user_id,nickname,created_at,updated_at")
    .eq("user_id", userId)
    .maybeSingle(), "Profile load");
  if (error) throwProfileError("get_profile", error, "get_profile");
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
  const { data, error } = await withProfileTimeout(client
    .from("profiles")
    .insert({ user_id: userId, nickname: validation.nickname })
    .select("user_id,nickname,created_at,updated_at")
    .single(), "Profile create");
  if (error) throwProfileError("create_profile", error, "create_profile");
  return data;
}

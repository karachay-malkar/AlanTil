import { msg } from "../i18n/index.js?v=16.8.0.7";
import { getSupabaseClient } from "../auth/supabase-client.js?v=16.8.0.7";
import {
  logSupabaseError,
  normalizeSupabaseError,
} from "../errors/supabase-error.js?v=16.8.0.7";
import {
  normalizeNickname,
  normalizeProfileGender,
  validateNicknameRule,
} from "../../../packages/alantil-core/profile.js?v=16.8.0.7";

const PROFILE_REQUEST_TIMEOUT_MS = 12000;
const PROFILE_COLUMNS = "user_id,nickname,avatar_gender,created_at,updated_at";

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

export async function createProfile(userId, value, avatarGender) {
  const validation = validateNickname(value);
  const gender = normalizeProfileGender(avatarGender);
  if (!validation.valid) throw new Error(validation.message);
  if (!gender) throw new Error(msg("account.vyberite_pol_avatara"));
  if (!userId) throw new Error(msg("service.polzovatel_ne_avtorizovan"));
  const client = await getSupabaseClient();
  let result = await withProfileTimeout(client
    .from("profiles")
    .update({ nickname: validation.nickname, avatar_gender: gender })
    .eq("user_id", userId)
    .select(PROFILE_COLUMNS)
    .maybeSingle(), "Profile save");
  if (result?.error) throwProfileError("create_profile", result.error, "create_profile");
  if (result?.data) return result.data;
  result = await withProfileTimeout(client
    .from("profiles")
    .insert({ user_id: userId, nickname: validation.nickname, avatar_gender: gender })
    .select(PROFILE_COLUMNS)
    .single(), "Profile create");
  if (result?.error) throwProfileError("create_profile", result.error, "create_profile");
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
  return data;
}

import { getSupabaseClient } from "../auth/supabase-client.js?v=13.6.2";
import {
  logSupabaseError,
  normalizeSupabaseError,
} from "../errors/supabase-error.js?v=13.6.2";

const NICKNAME_PATTERN = /^[\p{L}\p{N}_]{3,30}$/u;
const AVATAR_GENDERS = new Set(["male", "female"]);

function throwProfileError(scope, error, operation) {
  logSupabaseError(scope, error);
  throw normalizeSupabaseError(error, { operation });
}

export function normalizeNickname(value) {
  return String(value || "").trim();
}

export function validateNickname(value) {
  const nickname = normalizeNickname(value);
  if (!nickname) return { valid: false, nickname, message: "Введите никнейм." };
  if (nickname.length < 3 || nickname.length > 30) {
    return { valid: false, nickname, message: "Никнейм должен содержать от 3 до 30 символов." };
  }
  if (!NICKNAME_PATTERN.test(nickname)) {
    return { valid: false, nickname, message: "Используйте только буквы, цифры и знак подчёркивания." };
  }
  return { valid: true, nickname, message: "" };
}

export async function getProfile(userId) {
  if (!userId) return null;
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from("profiles")
    .select("user_id,nickname,avatar_gender,created_at,updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throwProfileError("get_profile", error, "get_profile");
  return data || null;
}

export async function isNicknameAvailable(value) {
  const validation = validateNickname(value);
  if (!validation.valid) return { ...validation, available: false };

  const client = await getSupabaseClient();
  const { data, error } = await client.rpc("is_nickname_available", {
    candidate: validation.nickname,
  });
  if (error) throwProfileError("check_nickname", error, "nickname_check");
  return {
    ...validation,
    available: Boolean(data),
    message: data ? "Никнейм свободен." : "Такой никнейм уже используется.",
  };
}

export async function createProfile(userId, value) {
  const validation = validateNickname(value);
  if (!validation.valid) throw new Error(validation.message);
  if (!userId) throw new Error("Пользователь не авторизован.");

  const client = await getSupabaseClient();
  const { data, error } = await client
    .from("profiles")
    .insert({ user_id: userId, nickname: validation.nickname })
    .select("user_id,nickname,avatar_gender,created_at,updated_at")
    .single();
  if (error) throwProfileError("create_profile", error, "create_profile");
  return data;
}

export function normalizeAvatarGender(value) {
  const gender = String(value || "").trim().toLowerCase();
  return AVATAR_GENDERS.has(gender) ? gender : "";
}

export async function setAvatarGender(userId, value) {
  const avatarGender = normalizeAvatarGender(value);
  if (!userId) throw new Error("Пользователь не авторизован.");
  if (!avatarGender) throw new Error("Выберите образ аватара.");

  const client = await getSupabaseClient();
  const { data, error } = await client
    .from("profiles")
    .update({ avatar_gender: avatarGender })
    .eq("user_id", userId)
    .is("avatar_gender", null)
    .select("user_id,nickname,avatar_gender,created_at,updated_at")
    .maybeSingle();
  if (error) throwProfileError("set_avatar_gender", error, "set_avatar_gender");
  if (data) return data;

  const current = await getProfile(userId);
  if (current?.avatar_gender === avatarGender) return current;
  throw new Error("Пол аватара уже выбран и не может быть изменён.");
}

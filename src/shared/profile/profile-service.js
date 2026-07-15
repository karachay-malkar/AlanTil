import { getSupabaseClient } from "../auth/supabase-client.js?v=13.1";
import {
  logSupabaseError,
  normalizeSupabaseError,
} from "../errors/supabase-error.js?v=13.1";

const NICKNAME_PATTERN = /^[\p{L}\p{N}_]{3,30}$/u;

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
    .select("user_id,nickname,created_at,updated_at")
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
    .select("user_id,nickname,created_at,updated_at")
    .single();
  if (error) throwProfileError("create_profile", error, "create_profile");
  return data;
}

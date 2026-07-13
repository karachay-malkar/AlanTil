import { getSupabaseClient } from "../auth/supabase-client.js";

const NICKNAME_PATTERN = /^[\p{L}\p{N}_]{3,30}$/u;

function normalizeDatabaseError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  if (code === "23505" || /duplicate key|unique constraint/i.test(message)) {
    return "Такой никнейм уже используется.";
  }
  if (code === "42501" || /row-level security|permission denied/i.test(message)) {
    return "Не удалось сохранить профиль. Проверьте настройки базы данных.";
  }
  return message || "Не удалось выполнить операцию с профилем.";
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
  if (error) throw new Error(normalizeDatabaseError(error));
  return data || null;
}

export async function isNicknameAvailable(value) {
  const validation = validateNickname(value);
  if (!validation.valid) return { ...validation, available: false };

  const client = await getSupabaseClient();
  const { data, error } = await client.rpc("is_nickname_available", {
    candidate: validation.nickname,
  });
  if (error) throw new Error(normalizeDatabaseError(error));
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
  if (error) throw new Error(normalizeDatabaseError(error));
  return data;
}

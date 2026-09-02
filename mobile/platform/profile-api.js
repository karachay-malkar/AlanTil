import { validateNicknameRule } from '../../packages/alantil-core/profile.js';
import { nativeAuthFetch } from './auth.js';

async function jsonOrNull(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function firstRow(value) {
  return Array.isArray(value) ? (value[0] || null) : value;
}

export async function loadNativeProfile(userId) {
  if (!userId) return null;
  const response = await nativeAuthFetch(`/rest/v1/profiles?user_id=eq.${encodeURIComponent(userId)}&select=user_id,nickname,avatar_gender,created_at,updated_at&limit=1`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return null;
  return firstRow(await jsonOrNull(response));
}

export async function checkNativeNickname(value) {
  const validation = validateNicknameRule(value);
  if (!validation.valid) return { ...validation, available: false };
  const response = await nativeAuthFetch('/rest/v1/rpc/is_nickname_available', {
    method: 'POST',
    body: JSON.stringify({ candidate: validation.nickname }),
  });
  if (!response.ok) return { ...validation, available: false, message: 'Не удалось проверить никнейм.' };
  const available = Boolean(await jsonOrNull(response));
  return { ...validation, available, message: available ? 'Никнейм свободен.' : 'Такой никнейм уже используется.' };
}

export async function createNativeProfile(userId, value) {
  const validation = validateNicknameRule(value);
  if (!validation.valid || !userId) throw new Error(validation.message || 'Пользователь не авторизован.');
  const response = await nativeAuthFetch('/rest/v1/profiles?select=user_id,nickname,avatar_gender,created_at,updated_at', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ user_id: userId, nickname: validation.nickname }),
  });
  const data = await jsonOrNull(response);
  if (!response.ok) throw new Error(data?.message || 'Не удалось создать профиль.');
  return firstRow(data);
}

export async function setNativeAvatarGender(userId, value) {
  const gender = ['male','female'].includes(String(value)) ? String(value) : '';
  if (!userId || !gender) throw new Error('Некорректный профиль.');
  const response = await nativeAuthFetch(`/rest/v1/profiles?user_id=eq.${encodeURIComponent(userId)}&avatar_gender=is.null&select=user_id,nickname,avatar_gender,created_at,updated_at`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ avatar_gender: gender }),
  });
  const data = await jsonOrNull(response);
  if (!response.ok) throw new Error(data?.message || 'Не удалось сохранить аватар.');
  const profile = firstRow(data) || await loadNativeProfile(userId);
  if (!profile) throw new Error('Профиль не найден.');
  return profile;
}

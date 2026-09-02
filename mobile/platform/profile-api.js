import { normalizeAvatarGender, validateNicknameRule } from '../../packages/alantil-core/profile.js';
import { nativeAuthFetch } from './auth.js';

export class NativeProfileApiError extends Error {
  constructor(message, { operation = 'profile', status = 0, unavailable = false, code = '' } = {}) {
    super(message || 'Profile API error');
    this.name = 'NativeProfileApiError';
    this.operation = operation;
    this.status = status;
    this.unavailable = Boolean(unavailable);
    this.code = code || '';
  }
}

async function jsonOrNull(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function firstRow(value) {
  return Array.isArray(value) ? (value[0] || null) : value;
}

function apiError(response, data, operation) {
  const status = Number(response?.status || 0);
  const unavailable = status === 0 || status === 408 || status === 429 || status >= 500;
  return new NativeProfileApiError(data?.message || data?.error_description || `${operation} failed`, {
    operation,
    status,
    unavailable,
    code: String(data?.code || ''),
  });
}

export function isNativeProfileApiUnavailable(error) {
  return Boolean(error?.unavailable || error?.name === 'TypeError' || error?.code === 'ALANTIL_TIMEOUT');
}

export async function loadNativeProfile(userId) {
  if (!userId) return null;
  let response;
  try {
    response = await nativeAuthFetch(`/rest/v1/profiles?user_id=eq.${encodeURIComponent(userId)}&select=user_id,nickname,avatar_gender,created_at,updated_at&limit=1`, {
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    throw new NativeProfileApiError(error?.message || 'Profile load failed', { operation: 'get_profile', unavailable: true });
  }
  const data = await jsonOrNull(response);
  if (!response.ok) throw apiError(response, data, 'get_profile');
  return firstRow(data);
}

export async function checkNativeNickname(value) {
  const validation = validateNicknameRule(value);
  if (!validation.valid) return { ...validation, available: false };
  let response;
  try {
    response = await nativeAuthFetch('/rest/v1/rpc/is_nickname_available', {
      method: 'POST',
      body: JSON.stringify({ candidate: validation.nickname }),
    });
  } catch (error) {
    throw new NativeProfileApiError(error?.message || 'Nickname check failed', { operation: 'nickname_check', unavailable: true });
  }
  const data = await jsonOrNull(response);
  if (!response.ok) throw apiError(response, data, 'nickname_check');
  return { ...validation, available: Boolean(data) };
}

export async function createNativeProfile(userId, value) {
  const validation = validateNicknameRule(value);
  if (!validation.valid || !userId) {
    throw new NativeProfileApiError('Invalid profile input', { operation: 'create_profile', code: validation.reason || 'unauthorized' });
  }
  let response;
  try {
    response = await nativeAuthFetch('/rest/v1/profiles?select=user_id,nickname,avatar_gender,created_at,updated_at', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ user_id: userId, nickname: validation.nickname }),
    });
  } catch (error) {
    throw new NativeProfileApiError(error?.message || 'Profile create failed', { operation: 'create_profile', unavailable: true });
  }
  const data = await jsonOrNull(response);
  if (!response.ok) throw apiError(response, data, 'create_profile');
  return firstRow(data);
}

export async function setNativeAvatarGender(userId, value) {
  const gender = normalizeAvatarGender(value);
  if (!userId || !gender) throw new NativeProfileApiError('Invalid avatar selection', { operation: 'set_avatar_gender', code: 'invalid' });
  let response;
  try {
    response = await nativeAuthFetch(`/rest/v1/profiles?user_id=eq.${encodeURIComponent(userId)}&avatar_gender=is.null&select=user_id,nickname,avatar_gender,created_at,updated_at`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ avatar_gender: gender }),
    });
  } catch (error) {
    throw new NativeProfileApiError(error?.message || 'Avatar update failed', { operation: 'set_avatar_gender', unavailable: true });
  }
  const data = await jsonOrNull(response);
  if (!response.ok) throw apiError(response, data, 'set_avatar_gender');
  const profile = firstRow(data) || await loadNativeProfile(userId);
  if (!profile) throw new NativeProfileApiError('Profile not found', { operation: 'set_avatar_gender', code: 'not_found' });
  return profile;
}

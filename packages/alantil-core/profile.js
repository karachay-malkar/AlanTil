const NICKNAME_PATTERN = /^[A-Za-z0-9_]{3,15}$/;
const LATIN_LETTER_PATTERN = /[A-Za-z]/g;
const AVATAR_GENDERS = new Set(['male', 'female']);

export function normalizeNickname(value) {
  return String(value || '').trim();
}

export function filterNickname(value) {
  return String(value || '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 15);
}

export function validateNicknameRule(value) {
  const nickname = normalizeNickname(value);
  if (!nickname) return { valid: false, nickname, reason: 'required' };
  if (nickname.length < 3 || nickname.length > 15) return { valid: false, nickname, reason: 'requirements' };
  if (!NICKNAME_PATTERN.test(nickname)) return { valid: false, nickname, reason: 'requirements' };
  if ((nickname.match(LATIN_LETTER_PATTERN) || []).length < 3) return { valid: false, nickname, reason: 'requirements' };
  return { valid: true, nickname, reason: null };
}

export function normalizeAvatarGender(value) {
  const gender = String(value || '').trim().toLowerCase();
  return AVATAR_GENDERS.has(gender) ? gender : '';
}

export function providerLabel(provider) {
  const value = String(provider || '').trim().toLowerCase();
  if (value === 'google') return 'Google';
  if (value === 'apple') return 'Apple';
  return value || '—';
}

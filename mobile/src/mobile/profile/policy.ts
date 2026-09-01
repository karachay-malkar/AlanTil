export type NicknameValidation = {
  nickname: string;
  valid: boolean;
  reason: 'required' | 'requirements' | null;
};

const NICKNAME_PATTERN = /^[A-Za-z0-9_]{3,15}$/;
const LATIN_LETTER_PATTERN = /[A-Za-z]/g;

export function filterNickname(value: unknown) {
  return String(value ?? '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 15);
}

export function validateNickname(value: unknown): NicknameValidation {
  const nickname = String(value ?? '').trim();
  if (!nickname) return { nickname, valid: false, reason: 'required' };
  if (!NICKNAME_PATTERN.test(nickname) || (nickname.match(LATIN_LETTER_PATTERN) || []).length < 3) {
    return { nickname, valid: false, reason: 'requirements' };
  }
  return { nickname, valid: true, reason: null };
}

export function providerLabel(appMetadata: Record<string, unknown> | null | undefined) {
  const provider = String(appMetadata?.provider ?? '').trim().toLowerCase();
  if (provider === 'google') return 'Google';
  if (provider === 'apple') return 'Apple';
  return provider || '—';
}

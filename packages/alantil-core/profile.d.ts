export type NicknameValidation = {
  nickname: string;
  valid: boolean;
  reason: 'required' | 'requirements' | null;
};

export type AvatarGender = 'male' | 'female' | '';

export function normalizeNickname(value: unknown): string;
export function filterNickname(value: unknown): string;
export function validateNickname(value: unknown): NicknameValidation;
export function normalizeAvatarGender(value: unknown): AvatarGender;
export function providerLabel(appMetadata: Record<string, unknown> | null | undefined): string;

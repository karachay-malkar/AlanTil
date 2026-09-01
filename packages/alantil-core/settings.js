export const INTERFACE_LANGUAGE_CODES = Object.freeze(['ru', 'en', 'tr']);
export const ALAN_SCRIPT_CODES = Object.freeze(['cyrillic', 'turkic']);
export const ALAN_DIALECT_CODES = Object.freeze(['canonical', 'karachay', 'balkar']);
export const TEXT_SIZE_CODES = Object.freeze(['small', 'medium', 'large']);
export const ONBOARDING_STEPS = Object.freeze(['setup', 'access', 'guide', 'done']);
export const ONBOARDING_ACCESS_MODES = Object.freeze(['guest', 'account']);

export const DEFAULT_USER_SETTINGS = Object.freeze({
  interface_language_code: 'ru',
  translation_language_code: 'ru',
  alan_script_code: 'cyrillic',
  alan_dialect_code: 'canonical',
  text_size_code: 'medium',
  onboarding_step: 'setup',
  onboarding_access_mode: null,
  learning_setup_completed_at: null,
  updated_at: null,
});

export function normalizeLanguageCode(value, fallback = 'ru') {
  const normalized = String(value || '').trim().toLowerCase();
  return /^[a-z]{2,8}(?:-[a-z0-9]{2,8})?$/.test(normalized) ? normalized : fallback;
}

export function normalizeInterfaceLanguageCode(value) {
  const source = normalizeLanguageCode(value, DEFAULT_USER_SETTINGS.interface_language_code).split('-')[0];
  const normalized = source === 'tu' ? 'tr' : source;
  return INTERFACE_LANGUAGE_CODES.includes(normalized)
    ? normalized
    : DEFAULT_USER_SETTINGS.interface_language_code;
}

export function normalizeTranslationLanguageCode(value, fallback = DEFAULT_USER_SETTINGS.translation_language_code) {
  const normalizedFallback = normalizeInterfaceLanguageCode(fallback);
  const normalized = normalizeInterfaceLanguageCode(value);
  return INTERFACE_LANGUAGE_CODES.includes(normalized) ? normalized : normalizedFallback;
}

export function normalizeAlanScriptCode(value) {
  return value === 'turkic' ? 'turkic' : 'cyrillic';
}

export function normalizeAlanDialectCode(value) {
  return ALAN_DIALECT_CODES.includes(value) ? value : DEFAULT_USER_SETTINGS.alan_dialect_code;
}

export function normalizeTextSizeCode(value) {
  return TEXT_SIZE_CODES.includes(value) ? value : DEFAULT_USER_SETTINGS.text_size_code;
}

export function normalizeTimestamp(value) {
  if (!value) return null;
  const timestamp = Date.parse(String(value));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export function normalizeOnboardingStep(value, learningSetupCompletedAt = null) {
  if (ONBOARDING_STEPS.includes(value)) return value;
  return normalizeTimestamp(learningSetupCompletedAt) ? 'done' : DEFAULT_USER_SETTINGS.onboarding_step;
}

export function normalizeOnboardingAccessMode(value) {
  return ONBOARDING_ACCESS_MODES.includes(value) ? value : null;
}

export function normalizeUserSettings(raw = {}) {
  const interfaceLanguage = normalizeInterfaceLanguageCode(raw?.interface_language_code);
  const learningSetupCompletedAt = normalizeTimestamp(raw?.learning_setup_completed_at);
  return {
    interface_language_code: interfaceLanguage,
    translation_language_code: normalizeTranslationLanguageCode(raw?.translation_language_code, interfaceLanguage),
    alan_script_code: normalizeAlanScriptCode(raw?.alan_script_code),
    alan_dialect_code: normalizeAlanDialectCode(raw?.alan_dialect_code),
    text_size_code: normalizeTextSizeCode(raw?.text_size_code),
    onboarding_step: normalizeOnboardingStep(raw?.onboarding_step, learningSetupCompletedAt),
    onboarding_access_mode: normalizeOnboardingAccessMode(raw?.onboarding_access_mode),
    learning_setup_completed_at: learningSetupCompletedAt,
    updated_at: normalizeTimestamp(raw?.updated_at),
  };
}

export function settingsCloudPayload(settings, userId = '') {
  const normalized = normalizeUserSettings(settings);
  return {
    user_id: String(userId || ''),
    interface_language_code: normalized.interface_language_code,
    translation_language_code: normalized.translation_language_code,
    alan_script_code: normalized.alan_script_code,
    alan_dialect_code: normalized.alan_dialect_code,
    text_size_code: normalized.text_size_code,
    learning_setup_completed_at: normalized.learning_setup_completed_at,
    updated_at: normalized.updated_at,
  };
}

export function completeLearningSetupSettings(settings, completedAt = new Date().toISOString()) {
  return normalizeUserSettings({
    ...settings,
    onboarding_step: 'done',
    learning_setup_completed_at: normalizeTimestamp(completedAt) || new Date().toISOString(),
  });
}

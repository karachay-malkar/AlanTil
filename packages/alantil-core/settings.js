export const LEGACY_SETUP_COMPLETED_AT = '2026-07-18T00:00:00.000Z';

export const DEFAULT_USER_SETTINGS = Object.freeze({
  interface_language_code: 'ru',
  translation_language_code: 'ru',
  alan_script_code: 'cyrillic',
  alan_dialect_code: 'canonical',
  text_size_code: 'medium',
  learning_setup_completed_at: null,
});

export function normalizeLanguageCode(value, fallback = 'ru') {
  const normalized = String(value || '').trim().toLowerCase();
  return /^[a-z]{2,8}(?:-[a-z0-9]{2,8})?$/.test(normalized) ? normalized : fallback;
}

export function normalizeInterfaceLanguageCode(value) {
  const source = normalizeLanguageCode(value, DEFAULT_USER_SETTINGS.interface_language_code).split('-')[0];
  const normalized = source === 'tu' ? 'tr' : source;
  return ['ru', 'en', 'tr'].includes(normalized) ? normalized : DEFAULT_USER_SETTINGS.interface_language_code;
}

export function normalizeAlanScriptCode(value) {
  return value === 'turkic' ? 'turkic' : 'cyrillic';
}

export function normalizeAlanDialectCode(value) {
  return ['canonical', 'karachay', 'balkar'].includes(value) ? value : 'canonical';
}

export function normalizeTextSizeCode(value) {
  return ['small', 'medium', 'large'].includes(value) ? value : DEFAULT_USER_SETTINGS.text_size_code;
}

export function normalizeCompletionTimestamp(value) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export function normalizeSyncTimestamp(value) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export function normalizeUserSettings(value = {}) {
  const interfaceLanguage = normalizeInterfaceLanguageCode(value.interface_language_code);
  return {
    interface_language_code: interfaceLanguage,
    translation_language_code: interfaceLanguage,
    alan_script_code: normalizeAlanScriptCode(value.alan_script_code),
    alan_dialect_code: normalizeAlanDialectCode(value.alan_dialect_code),
    text_size_code: normalizeTextSizeCode(value.text_size_code),
    learning_setup_completed_at: normalizeCompletionTimestamp(value.learning_setup_completed_at),
  };
}

export function migrateStoredUserSettings(stored, hasStoredSettings) {
  if (hasStoredSettings && stored && typeof stored === 'object'
      && !Object.prototype.hasOwnProperty.call(stored, 'learning_setup_completed_at')) {
    return { ...stored, learning_setup_completed_at: LEGACY_SETUP_COMPLETED_AT };
  }
  return stored;
}

export function userSettingsChanged(previous, next) {
  return next.interface_language_code !== previous.interface_language_code
    || next.translation_language_code !== previous.translation_language_code
    || next.alan_script_code !== previous.alan_script_code
    || next.alan_dialect_code !== previous.alan_dialect_code
    || next.text_size_code !== previous.text_size_code
    || next.learning_setup_completed_at !== previous.learning_setup_completed_at;
}

export function applyUserSettingsUpdate(current, updates = {}) {
  return normalizeUserSettings({ ...current, ...updates });
}

export function hasCompletedLearningSetup(settings) {
  return Boolean(normalizeCompletionTimestamp(settings?.learning_setup_completed_at));
}

export function completeLearningSetupSettings(current, updates = {}, completedAt = new Date().toISOString()) {
  return applyUserSettingsUpdate(current, { ...updates, learning_setup_completed_at: completedAt });
}

export function replaceUserSettingsValue(current, settings = {}) {
  const incoming = settings && typeof settings === 'object' ? settings : {};
  const withLocalTextSize = Object.prototype.hasOwnProperty.call(incoming, 'text_size_code')
    ? incoming
    : { ...incoming, text_size_code: current.text_size_code };
  const merged = Object.prototype.hasOwnProperty.call(withLocalTextSize, 'learning_setup_completed_at')
    ? withLocalTextSize
    : { ...withLocalTextSize, learning_setup_completed_at: current.learning_setup_completed_at };
  return normalizeUserSettings(merged);
}

export function resolveTimestampedUserSettings({ localSettings = {}, localUpdatedAt = null, cloudSettings = {}, cloudUpdatedAt = null } = {}) {
  const local = normalizeUserSettings(localSettings);
  const cloud = normalizeUserSettings({ ...cloudSettings, text_size_code: local.text_size_code });
  const localTime = Date.parse(normalizeSyncTimestamp(localUpdatedAt) || '') || 0;
  const cloudTime = Date.parse(normalizeSyncTimestamp(cloudUpdatedAt) || '') || 0;
  if (localTime > cloudTime) return { settings: local, updated_at: normalizeSyncTimestamp(localUpdatedAt), source: 'local' };
  return { settings: cloud, updated_at: normalizeSyncTimestamp(cloudUpdatedAt), source: 'cloud' };
}

export function emptyLearningSetupDraft() {
  return {
    interface_language_code: '',
    translation_language_code: '',
    alan_script_code: '',
    alan_dialect_code: '',
  };
}

export function isLearningSetupDraftComplete(draft = {}) {
  if (!['ru', 'en', 'tr'].includes(draft.interface_language_code)) return false;
  if (!['cyrillic', 'turkic'].includes(draft.alan_script_code)) return false;
  if (draft.alan_script_code === 'cyrillic'
      && !['canonical', 'karachay', 'balkar'].includes(draft.alan_dialect_code)) return false;
  return true;
}

export const SUPPORTED_INTERFACE_LANGUAGES = Object.freeze(['ru', 'en', 'tr']);

export function normalizeInterfaceLanguage(value) {
  const source = String(value || '').trim().toLowerCase().split('-')[0];
  const normalized = source === 'tu' ? 'tr' : source;
  return SUPPORTED_INTERFACE_LANGUAGES.includes(normalized) ? normalized : 'ru';
}

export function interfaceLocale(language) {
  return { ru: 'ru-RU', en: 'en-GB', tr: 'tr-TR' }[normalizeInterfaceLanguage(language)] || 'ru-RU';
}

export function interpolateMessage(template, params = {}) {
  return String(template || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (placeholder, name) => (
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name] ?? '') : placeholder
  ));
}

export function translatedMessage(messages, language, key) {
  const locale = normalizeInterfaceLanguage(language);
  const translated = messages?.[key]?.[locale];
  return translated ? { value: translated, missing: false, locale } : { value: String(key || ''), missing: true, locale };
}

export function messageForLanguage(messages, language, key, params = {}) {
  const result = translatedMessage(messages, language, key);
  return { ...result, value: interpolateMessage(result.value, params) };
}

export function hasCompleteTranslations(messages, language) {
  const locale = normalizeInterfaceLanguage(language);
  return Object.values(messages || {}).every((entry) => Boolean(entry?.[locale]));
}

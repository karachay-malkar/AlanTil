export const SUPPORTED_INTERFACE_LANGUAGES = Object.freeze(['ru', 'en', 'tr']);
export const INTERFACE_LOCALES = Object.freeze({ ru: 'ru-RU', en: 'en-GB', tr: 'tr-TR' });

export function normalizeInterfaceLanguage(value) {
  const source = String(value || '').trim().toLowerCase().split('-')[0];
  const normalized = source === 'tu' ? 'tr' : source;
  return SUPPORTED_INTERFACE_LANGUAGES.includes(normalized) ? normalized : 'ru';
}

export function interfaceLocale(language) {
  return INTERFACE_LOCALES[normalizeInterfaceLanguage(language)] || INTERFACE_LOCALES.ru;
}

export function interpolateMessage(template, params = {}) {
  return String(template || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (placeholder, name) => (
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name] ?? '') : placeholder
  ));
}

export function messageFromCatalog(catalog, language, key, params = {}, fallbackLanguage = 'ru') {
  const locale = normalizeInterfaceLanguage(language);
  const fallback = normalizeInterfaceLanguage(fallbackLanguage);
  const entry = catalog?.[key];
  const template = entry?.[locale] || entry?.[fallback] || key;
  return interpolateMessage(template, params);
}

export function hasCompleteCatalog(catalog, language) {
  const locale = normalizeInterfaceLanguage(language);
  return Object.values(catalog || {}).every((entry) => Boolean(entry?.[locale]));
}

import { INTERFACE_MESSAGES } from '../src/shared/i18n/messages.js';
import { RELEASE_MESSAGES_13_10 } from '../src/shared/i18n/messages-13-10.js';
import { RELEASE_MESSAGES_13_15_9 } from '../src/shared/i18n/messages-13-15-9.js';
import { RELEASE_MESSAGES_13_15_10 } from '../src/shared/i18n/messages-13-15-10.js';
import { RELEASE_MESSAGES_13_15_12 } from '../src/shared/i18n/messages-13-15-12.js';

export const SUPPORTED_INTERFACE_LANGUAGES = Object.freeze(['ru','en','tr']);

const ALL_INTERFACE_MESSAGES = Object.freeze({
  ...INTERFACE_MESSAGES,
  ...RELEASE_MESSAGES_13_10,
  ...RELEASE_MESSAGES_13_15_9,
  ...RELEASE_MESSAGES_13_15_10,
  ...RELEASE_MESSAGES_13_15_12,
});

const MOBILE_MESSAGE_ALIASES=Object.freeze({
  'common.otmena':'common.ostatsya',
});

export function normalizeInterfaceLanguage(value) {
  const source=String(value||'').trim().toLowerCase().split('-')[0];
  const normalized=source==='tu'?'tr':source;
  return SUPPORTED_INTERFACE_LANGUAGES.includes(normalized)?normalized:'ru';
}

function interpolate(template,params={}) {
  return String(template||'').replace(/\{([a-zA-Z0-9_]+)\}/g,(placeholder,name)=>Object.prototype.hasOwnProperty.call(params,name)?String(params[name]??''):placeholder);
}

export function messageForLanguage(language,key,params={}) {
  const locale=normalizeInterfaceLanguage(language);
  const resolvedKey=MOBILE_MESSAGE_ALIASES[key]||key;
  const entry=ALL_INTERFACE_MESSAGES[resolvedKey];
  const template=entry?.[locale]||entry?.ru||resolvedKey;
  return interpolate(template,params);
}

export function mobileMsg(language,key,params={}) {
  return messageForLanguage(language,key,params);
}

export function msg(settings,key,params={}) {
  return messageForLanguage(settings?.interface_language_code,key,params);
}

export function mobileLocale(language) {
  return {ru:'ru-RU',en:'en-GB',tr:'tr-TR'}[normalizeInterfaceLanguage(language)]||'ru-RU';
}

export function hasMobileTranslation(language,key) {
  const resolvedKey=MOBILE_MESSAGE_ALIASES[key]||key;
  return Boolean(ALL_INTERFACE_MESSAGES[resolvedKey]?.[normalizeInterfaceLanguage(language)]);
}

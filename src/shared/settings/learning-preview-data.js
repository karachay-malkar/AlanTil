export const LEARNING_SETUP_LANGUAGES = Object.freeze([
  Object.freeze({ code: "ru", label: "Русский", short: "RU" }),
  Object.freeze({ code: "en", label: "English", short: "EN" }),
  Object.freeze({ code: "tr", label: "Türkçe", short: "TR" }),
]);

export const LEARNING_PREVIEW = Object.freeze({
  word: Object.freeze({
    cyrillic: Object.freeze({ canonical: "җигер", karachay: "джигер", balkar: "жигер" }),
    turkic: "ciger",
  }),
  example: Object.freeze({
    cyrillic: Object.freeze({ canonical: "җигер урунуу", karachay: "джигер урунуу", balkar: "жигер урунуу" }),
    turkic: "ciger urunuw",
  }),
  translations: Object.freeze({
    ru: Object.freeze({ word: "деятельный, активный, проворный", example: "доблестный труд" }),
    en: Object.freeze({ word: "energetic, active, agile", example: "valiant work" }),
    tr: Object.freeze({ word: "gayretli, aktif, çevik", example: "yiğitçe emek" }),
  }),
});

export const LEARNING_SETUP_TEXT = Object.freeze({
  ru: Object.freeze({
    title: "Настрой обучение под себя",
    script: "Написание аланских слов",
    cyrillic: "Кириллица",
    continue: "Продолжить",
    dialect: "Выберите форму",
    preview: "Предпросмотр учебной карточки",
    storageError: "Не удалось сохранить настройки на этом устройстве.",
  }),
  en: Object.freeze({
    title: "Set up learning for yourself",
    script: "Alan word script",
    cyrillic: "Cyrillic",
    continue: "Continue",
    dialect: "Choose the letter form",
    preview: "Learning card preview",
    storageError: "Settings could not be saved on this device.",
  }),
  tr: Object.freeze({
    title: "Öğrenmeni kendine göre ayarla",
    script: "Alanca kelimelerin yazımı",
    cyrillic: "Kiril",
    continue: "Devam et",
    dialect: "Harf biçimini seçin",
    preview: "Öğrenme kartı önizlemesi",
    storageError: "Ayarlar bu cihaza kaydedilemedi.",
  }),
});

export function setupText(language) {
  return LEARNING_SETUP_TEXT[language] || LEARNING_SETUP_TEXT.ru;
}

export function previewContent(settings = {}) {
  const language = ["ru", "en", "tr"].includes(settings.interface_language_code)
    ? settings.interface_language_code
    : "ru";
  const script = settings.alan_script_code === "turkic" ? "turkic" : "cyrillic";
  const dialect = ["canonical", "karachay", "balkar"].includes(settings.alan_dialect_code)
    ? settings.alan_dialect_code
    : "canonical";
  const translation = LEARNING_PREVIEW.translations[language];
  return {
    word: script === "turkic" ? LEARNING_PREVIEW.word.turkic : LEARNING_PREVIEW.word.cyrillic[dialect],
    example: script === "turkic" ? LEARNING_PREVIEW.example.turkic : LEARNING_PREVIEW.example.cyrillic[dialect],
    translation: translation.word,
    exampleTranslation: translation.example,
  };
}

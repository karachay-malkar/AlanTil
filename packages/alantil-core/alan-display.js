import { combineNumberedExamples } from './example-groups.js';

function text(value) {
  return String(value || '').trim();
}

export function normalizeDisplaySettings(settings = {}) {
  const interfaceLanguage = ['ru', 'en', 'tr'].includes(settings?.interface_language_code)
    ? settings.interface_language_code
    : 'ru';
  const translationLanguage = ['ru', 'en', 'tr'].includes(settings?.translation_language_code)
    ? settings.translation_language_code
    : interfaceLanguage;
  return {
    script: settings?.alan_script_code === 'turkic' ? 'turkic' : 'cyrillic',
    dialect: ['canonical', 'karachay', 'balkar'].includes(settings?.alan_dialect_code)
      ? settings.alan_dialect_code
      : 'canonical',
    interfaceLanguage,
    translationLanguage,
  };
}

export function applyAlanCyrillicDialect(value, dialect = 'canonical') {
  const source = text(value);
  if (!source) return '';
  if (dialect === 'balkar') return source.replaceAll('Җ', 'Ж').replaceAll('җ', 'ж');
  if (dialect === 'karachay') return source.replaceAll('Җ', 'Дж').replaceAll('җ', 'дж');
  return source;
}

export function getDisplayedSessionExitPhrase(settings) {
  return normalizeDisplaySettings(settings).script === 'turkic'
    ? 'Ne bolsa da bolsun!'
    : 'Не болса да болсун!';
}

function displayedAlanValue(entry, cyrillicKey, turkicKey, settings) {
  const selected = normalizeDisplaySettings(settings);
  if (selected.script === 'turkic') return text(entry?.[turkicKey]);
  return applyAlanCyrillicDialect(entry?.[cyrillicKey], selected.dialect);
}

export function getDisplayedAlanWord(entry, settings) {
  return displayedAlanValue(entry, 'wordAlanCyrillic', 'wordAlanTurkic', settings);
}

export function getDisplayedAlanPhrases(entry, settings) {
  return displayedAlanValue(entry, 'phrasesAlanCyrillic', 'phrasesAlanTurkic', settings);
}

function localizedValue(entry, language, keys) {
  if (language === 'en') return text(entry?.[keys.english]);
  if (language === 'tr') return text(entry?.[keys.turkish]);
  return text(entry?.[keys.russian]);
}

function displayedStructureName(entry, keys, settings) {
  return localizedValue(entry, normalizeDisplaySettings(settings).interfaceLanguage, keys);
}

export function getDisplayedStoryName(entry, settings) {
  return displayedStructureName(entry, { russian: 'storyNameRu', english: 'storyNameEn', turkish: 'storyNameTr' }, settings);
}
export function getDisplayedDictionaryName(entry, settings) {
  return displayedStructureName(entry, { russian: 'dictionaryNameRu', english: 'dictionaryNameEn', turkish: 'dictionaryNameTr' }, settings);
}
export function getDisplayedSectionName(entry, settings) {
  return displayedStructureName(entry, { russian: 'sectionNameRu', english: 'sectionNameEn', turkish: 'sectionNameTr' }, settings);
}
export function getDisplayedSetName(entry, settings) {
  return displayedStructureName(entry, { russian: 'setNameRu', english: 'setNameEn', turkish: 'setNameTr' }, settings);
}
export function getDisplayedStoryIntro(entry, settings) {
  return displayedStructureName(entry, { russian: 'storyIntroRu', english: 'storyIntroEn', turkish: 'storyIntroTr' }, settings);
}

export function getDisplayedTranslation(entry, settings) {
  const selected = normalizeDisplaySettings(settings);
  return localizedValue(entry, selected.translationLanguage, { russian: 'translationRu', english: 'translationEn', turkish: 'translationTr' });
}

function getDisplayedTranslatedPhrases(entry, settings) {
  const selected = normalizeDisplaySettings(settings);
  return localizedValue(entry, selected.translationLanguage, { russian: 'phrasesRu', english: 'phrasesEn', turkish: 'phrasesTr' });
}

export function getDisplayedExample(entry, settings) {
  if (entry?.legacyExample) return normalizeDisplaySettings(settings).translationLanguage === 'ru' ? text(entry.legacyExample) : '';
  return combineNumberedExamples(getDisplayedAlanPhrases(entry, settings), getDisplayedTranslatedPhrases(entry, settings));
}

export function getDisplayedWordEntry(entry, settings) {
  if (!entry) return entry;
  const storyName = getDisplayedStoryName(entry, settings);
  const dictionaryName = getDisplayedDictionaryName(entry, settings);
  const sectionName = getDisplayedSectionName(entry, settings);
  const setName = getDisplayedSetName(entry, settings);
  const storyIntro = getDisplayedStoryIntro(entry, settings);
  return {
    ...entry,
    word: getDisplayedAlanWord(entry, settings), trans: getDisplayedTranslation(entry, settings), example: getDisplayedExample(entry, settings),
    story_name: storyName, story_intro: storyIntro, dictionary_name: dictionaryName, section_name: sectionName, set_name: setName,
    dict: dictionaryName, section: sectionName, set: setName,
  };
}

export function getDisplayedWordCollection(words, settings) {
  return (Array.isArray(words) ? words : []).map((word) => getDisplayedWordEntry(word, settings));
}

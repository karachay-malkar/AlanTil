import { combineNumberedExamples } from "./example-groups.js?v=13.10.12";
import { getUserSettings } from "../settings/user-settings-store.js?v=13.10.12";

function text(value) {
  return String(value || "").trim();
}

function displaySettings(settings) {
  const source = settings || getUserSettings();
  const interfaceLanguage = ["ru", "en", "tr"].includes(source?.interface_language_code)
    ? source.interface_language_code
    : "ru";
  const translationLanguage = ["ru", "en", "tr"].includes(source?.translation_language_code)
    ? source.translation_language_code
    : interfaceLanguage;
  return {
    script: source?.alan_script_code === "turkic" ? "turkic" : "cyrillic",
    dialect: ["canonical", "karachay", "balkar"].includes(source?.alan_dialect_code)
      ? source.alan_dialect_code
      : "canonical",
    interfaceLanguage,
    translationLanguage,
  };
}

export function applyAlanCyrillicDialect(value, dialect = "canonical") {
  const source = text(value);
  if (!source) return "";
  if (dialect === "balkar") return source.replaceAll("Җ", "Ж").replaceAll("җ", "ж");
  if (dialect === "karachay") return source.replaceAll("Җ", "Дж").replaceAll("җ", "дж");
  return source;
}

export function getDisplayedSessionExitPhrase(settings) {
  return displaySettings(settings).script === "turkic"
    ? "Ne bolsa da bolsun!"
    : "Не болса да болсун!";
}

function displayedAlanValue(entry, cyrillicKey, turkicKey, settings) {
  const selected = displaySettings(settings);
  if (selected.script === "turkic") {
    return text(entry?.[turkicKey]);
  }
  return applyAlanCyrillicDialect(entry?.[cyrillicKey], selected.dialect);
}

export function getDisplayedAlanWord(entry, settings) {
  return displayedAlanValue(entry, "wordAlanCyrillic", "wordAlanTurkic", settings);
}

export function getDisplayedAlanPhrases(entry, settings) {
  return displayedAlanValue(entry, "phrasesAlanCyrillic", "phrasesAlanTurkic", settings);
}

function localizedValue(entry, language, keys) {
  if (language === "en") return text(entry?.[keys.english]);
  if (language === "tr") return text(entry?.[keys.turkish]);
  return text(entry?.[keys.russian]);
}

const STRUCTURE_TERMS = Object.freeze({
  story: Object.freeze({ ru: "Маршрут", en: "Route", tr: "Yol" }),
  dictionary: Object.freeze({ ru: "Словарь", en: "Dictionary", tr: "Sözlük" }),
  section: Object.freeze({ ru: "Раздел", en: "Section", tr: "Bölüm" }),
  set: Object.freeze({ ru: "Набор слов", en: "Word set", tr: "Kelime seti" }),
});

function displayedStructureName(entry, keys, idKeys, kind, settings) {
  const selected = displaySettings(settings);
  const localized = localizedValue(entry, selected.interfaceLanguage, keys);
  if (localized) return localized;
  const id = idKeys.map((key) => text(entry?.[key])).find(Boolean) || "";
  if (!id) return "";
  return `${STRUCTURE_TERMS[kind][selected.interfaceLanguage]} ${id}`;
}

export function getDisplayedStoryName(entry, settings) {
  return displayedStructureName(entry, {
    russian: "storyNameRu",
    english: "storyNameEn",
    turkish: "storyNameTr",
  }, ["storyId", "story_id"], "story", settings);
}

export function getDisplayedDictionaryName(entry, settings) {
  return displayedStructureName(entry, {
    russian: "dictionaryNameRu",
    english: "dictionaryNameEn",
    turkish: "dictionaryNameTr",
  }, ["dictionaryId", "dictionary_id"], "dictionary", settings);
}

export function getDisplayedSectionName(entry, settings) {
  return displayedStructureName(entry, {
    russian: "sectionNameRu",
    english: "sectionNameEn",
    turkish: "sectionNameTr",
  }, ["sectionId", "section_id"], "section", settings);
}

export function getDisplayedSetName(entry, settings) {
  return displayedStructureName(entry, {
    russian: "setNameRu",
    english: "setNameEn",
    turkish: "setNameTr",
  }, ["setId", "set_id"], "set", settings);
}

export function getDisplayedTranslation(entry, settings) {
  const selected = displaySettings(settings);
  return localizedValue(entry, selected.translationLanguage, {
    russian: "translationRu",
    english: "translationEn",
    turkish: "translationTr",
  });
}

function getDisplayedTranslatedPhrases(entry, settings) {
  const selected = displaySettings(settings);
  return localizedValue(entry, selected.translationLanguage, {
    russian: "phrasesRu",
    english: "phrasesEn",
    turkish: "phrasesTr",
  });
}

export function getDisplayedExample(entry, settings) {
  if (entry?.legacyExample) {
    return displaySettings(settings).translationLanguage === "ru" ? text(entry.legacyExample) : "";
  }
  return combineNumberedExamples(
    getDisplayedAlanPhrases(entry, settings),
    getDisplayedTranslatedPhrases(entry, settings),
  );
}

export function getDisplayedWordEntry(entry, settings) {
  if (!entry) return entry;
  const storyName = getDisplayedStoryName(entry, settings);
  const dictionaryName = getDisplayedDictionaryName(entry, settings);
  const sectionName = getDisplayedSectionName(entry, settings);
  const setName = getDisplayedSetName(entry, settings);
  return {
    ...entry,
    word: getDisplayedAlanWord(entry, settings),
    trans: getDisplayedTranslation(entry, settings),
    example: getDisplayedExample(entry, settings),
    story_name: storyName,
    dictionary_name: dictionaryName,
    section_name: sectionName,
    set_name: setName,
    // Legacy aliases are still consumed by a few menus. Keep them in the
    // selected language, or use a neutral stable id — never another language.
    dict: dictionaryName || text(entry.dictionaryId || entry.dictionary_id),
    section: sectionName || text(entry.sectionId || entry.section_id),
    set: setName || text(entry.setId || entry.set_id),
  };
}

export function getDisplayedWordCollection(words, settings) {
  return (Array.isArray(words) ? words : []).map((word) => getDisplayedWordEntry(word, settings));
}

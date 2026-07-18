import { getUserSettings } from "../settings/user-settings-store.js?v=13.10.8";

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

function displayedAlanValue(entry, cyrillicKey, turkicKey, settings) {
  const selected = displaySettings(settings);
  if (selected.script === "turkic") {
    return text(entry?.[turkicKey]) || text(entry?.[cyrillicKey]);
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
  if (language === "en") return text(entry?.[keys.english]) || text(entry?.[keys.russian]);
  if (language === "tr") return text(entry?.[keys.turkish]) || text(entry?.[keys.russian]);
  return text(entry?.[keys.russian]);
}

function displayedStructureName(entry, keys, settings) {
  const selected = displaySettings(settings);
  return localizedValue(entry, selected.interfaceLanguage, keys);
}

export function getDisplayedStoryName(entry, settings) {
  return displayedStructureName(entry, {
    russian: "storyNameRu",
    english: "storyNameEn",
    turkish: "storyNameTr",
  }, settings);
}

export function getDisplayedDictionaryName(entry, settings) {
  return displayedStructureName(entry, {
    russian: "dictionaryNameRu",
    english: "dictionaryNameEn",
    turkish: "dictionaryNameTr",
  }, settings);
}

export function getDisplayedSectionName(entry, settings) {
  return displayedStructureName(entry, {
    russian: "sectionNameRu",
    english: "sectionNameEn",
    turkish: "sectionNameTr",
  }, settings);
}

export function getDisplayedSetName(entry, settings) {
  return displayedStructureName(entry, {
    russian: "setNameRu",
    english: "setNameEn",
    turkish: "setNameTr",
  }, settings);
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

function numberedPhraseRows(value) {
  const source = text(value);
  if (!source) return [];
  return source
    .split(/\r?\n|\s*;\s*/)
    .map((line, index) => {
      const clean = text(line);
      const match = clean.match(/^(\d+\.\d+)\s+(.+)$/u);
      return match
        ? { key: match[1], text: match[2].trim() }
        : { key: `line-${index + 1}`, text: clean };
    })
    .filter((entry) => entry.text);
}

export function getDisplayedExample(entry, settings) {
  if (entry?.legacyExample) return text(entry.legacyExample);
  const alanRows = numberedPhraseRows(getDisplayedAlanPhrases(entry, settings));
  const translatedRows = numberedPhraseRows(getDisplayedTranslatedPhrases(entry, settings));
  if (!alanRows.length && !translatedRows.length) return "";
  const translatedByKey = new Map(translatedRows.map((row) => [row.key, row.text]));
  return alanRows.map((row, index) => {
    const translation = translatedByKey.get(row.key) || translatedRows[index]?.text || "";
    return [row.text, translation].filter(Boolean).join(" ✦ ");
  }).join("; ");
}

export function getDisplayedWordEntry(entry, settings) {
  if (!entry) return entry;
  return {
    ...entry,
    word: getDisplayedAlanWord(entry, settings),
    trans: getDisplayedTranslation(entry, settings),
    example: getDisplayedExample(entry, settings),
    story_name: getDisplayedStoryName(entry, settings),
    dictionary_name: getDisplayedDictionaryName(entry, settings),
    section_name: getDisplayedSectionName(entry, settings),
    set_name: getDisplayedSetName(entry, settings),
  };
}

export function getDisplayedWordCollection(words, settings) {
  return (Array.isArray(words) ? words : []).map((word) => getDisplayedWordEntry(word, settings));
}

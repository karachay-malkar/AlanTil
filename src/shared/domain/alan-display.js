import { getUserSettings } from "../settings/user-settings-store.js?v=13.8";

function text(value) {
  return String(value || "").trim();
}

function displaySettings(settings) {
  const source = settings || getUserSettings();
  return {
    script: source?.alan_script_code === "turkic" ? "turkic" : "cyrillic",
    dialect: ["canonical", "karachay", "balkar"].includes(source?.alan_dialect_code)
      ? source.alan_dialect_code
      : "canonical",
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

function displayedStructureName(entry, keys, settings) {
  return displayedAlanValue(entry, keys.cyrillic, keys.turkic, settings)
    || text(entry?.[keys.russian]);
}

export function getDisplayedStoryName(entry, settings) {
  return displayedStructureName(entry, {
    cyrillic: "storyNameAlanCyrillic",
    turkic: "storyNameAlanTurkic",
    russian: "storyNameRu",
  }, settings);
}

export function getDisplayedDictionaryName(entry, settings) {
  return displayedStructureName(entry, {
    cyrillic: "dictionaryNameAlanCyrillic",
    turkic: "dictionaryNameAlanTurkic",
    russian: "dictionaryNameRu",
  }, settings);
}

export function getDisplayedSectionName(entry, settings) {
  return displayedStructureName(entry, {
    cyrillic: "sectionNameAlanCyrillic",
    turkic: "sectionNameAlanTurkic",
    russian: "sectionNameRu",
  }, settings);
}

export function getDisplayedSetName(entry, settings) {
  return displayedStructureName(entry, {
    cyrillic: "setNameAlanCyrillic",
    turkic: "setNameAlanTurkic",
    russian: "setNameRu",
  }, settings);
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
  const russianRows = numberedPhraseRows(entry?.phrasesRu);
  if (!alanRows.length && !russianRows.length) return "";
  const russianByKey = new Map(russianRows.map((row) => [row.key, row.text]));
  return alanRows.map((row, index) => {
    const translation = russianByKey.get(row.key) || russianRows[index]?.text || "";
    return [row.text, translation].filter(Boolean).join(" ✦ ");
  }).join("; ");
}

export function getDisplayedWordEntry(entry, settings) {
  if (!entry) return entry;
  return {
    ...entry,
    word: getDisplayedAlanWord(entry, settings),
    trans: text(entry.translationRu),
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

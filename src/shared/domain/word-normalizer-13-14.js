import * as base from "/src/shared/domain/word-normalizer.js?v=13.13&base=1";

const THEMATIC_SECTIONS = new Set(["universe", "animals", "natural_materials", "plants"]);
const DICTIONARY_NAME_RU = "Тематические слова";
const SECTION_NAMES_RU = Object.freeze({
  universe: "Вселенная",
  animals: "Животные",
  natural_materials: "Природные материалы",
  plants: "Растения",
});

function adaptThematic(word) {
  if (!word || typeof word !== "object") return word;
  const oldDictionary = String(word.dictionaryId || word.dictionary_id || "").trim();
  if (!THEMATIC_SECTIONS.has(oldDictionary)) return word;
  const oldTopicNameRu = String(word.sectionNameRu || word.section_name || word.section || "").trim();
  const sectionNameRu = SECTION_NAMES_RU[oldDictionary] || "";
  return {
    ...word,
    dictionaryId: "thematic",
    dictionary_id: "thematic",
    catalog_id: "thematic",
    dictionaryNameRu: DICTIONARY_NAME_RU,
    dictionary_name: DICTIONARY_NAME_RU,
    dict: DICTIONARY_NAME_RU,
    sectionId: oldDictionary,
    section_id: oldDictionary,
    group_id: oldDictionary,
    sectionNameRu,
    section_name: sectionNameRu,
    section: sectionNameRu,
    setNameRu: oldTopicNameRu || String(word.setNameRu || word.set_name || "").trim(),
    set_name: oldTopicNameRu || String(word.setNameRu || word.set_name || "").trim(),
    set: oldTopicNameRu || String(word.setNameRu || word.set_name || "").trim(),
    storyId: "pathways",
    story_id: "pathways",
    story_type: "pathways",
  };
}

export const normalizeId = base.normalizeId;
export const normalizePos = base.normalizePos;
export const parseSynonyms = base.parseSynonyms;
export const parseUsedInTest = base.parseUsedInTest;
export const permanentSectionId = base.permanentSectionId;
export const storyIdForDictionary = base.storyIdForDictionary;

export function normalizeSupabaseWordEntry(row, story = null) {
  return base.normalizeSupabaseWordEntry(row, story);
}

export function normalizeLegacyWordEntry(row) {
  return adaptThematic(base.normalizeLegacyWordEntry(row));
}

export function normalizeWordEntry(row, options = {}) {
  return adaptThematic(base.normalizeWordEntry(row, options));
}

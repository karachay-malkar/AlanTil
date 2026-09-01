import {
  buildRoundPOSList,
  buildWordsByPOSRounds,
  hasWordConflict,
  shuffle,
  splitGroups,
  uniq,
} from "../../../packages/alantil-core/practice.js";

export { buildRoundPOSList, buildWordsByPOSRounds, hasWordConflict, shuffle, splitGroups, uniq };

export function sortNatural(a, b) {
  return String(a).localeCompare(String(b), "ru", { numeric: true, sensitivity: "base" });
}

function dictionaryId(word) {
  return String(word?.dictionary_id || word?.dictionaryId || "").trim();
}

function sectionId(word) {
  return String(word?.section_id || word?.sectionId || "").trim();
}

function sourceSetId(word) {
  return String(word?.set_id || word?.setId || "").trim();
}

function orderedWords(words) {
  return (Array.isArray(words) ? words : []).slice()
    .sort((left, right) => Number(left.global_order || left.dict_order || 0) - Number(right.global_order || right.dict_order || 0));
}

export function dictsFrom(words) {
  const order = new Map();
  orderedWords(words).forEach((word, index) => {
    const id = dictionaryId(word);
    if (id && !order.has(id)) order.set(id, index);
  });
  return Array.from(order.keys());
}

export function sectionsFrom(words, dict) {
  const dictionary = String(dict || "").trim();
  const order = new Map();
  orderedWords(words).forEach((word, index) => {
    if (dictionaryId(word) !== dictionary) return;
    const id = sectionId(word);
    if (id && !order.has(id)) order.set(id, index);
  });
  return Array.from(order.keys());
}

export function setsFrom(words, dict, section = "") {
  const dictionary = String(dict || "").trim();
  const sectionScope = String(section || "").trim();
  const named = new Map();
  orderedWords(words).forEach((word, index) => {
    if (dictionaryId(word) !== dictionary) return;
    if (sectionScope && sectionId(word) !== sectionScope) return;
    const id = sourceSetId(word);
    if (id && !named.has(id)) named.set(id, index);
  });
  return Array.from(named.keys());
}

export function wordsForSection(words, dict, section) {
  const dictionary = String(dict || "").trim();
  const sectionScope = String(section || "").trim();
  if (!dictionary || !sectionScope) return [];
  return orderedWords(words).filter((word) => dictionaryId(word) === dictionary && sectionId(word) === sectionScope);
}

export function wordsForSet(words, dict, section, setNumber) {
  const dictionary = String(dict || "").trim();
  const sectionScope = String(section || "").trim();
  const setId = String(setNumber || "").trim();
  if (!dictionary || !sectionScope || !setId) return [];
  return orderedWords(words).filter((word) => dictionaryId(word) === dictionary
    && sectionId(word) === sectionScope
    && sourceSetId(word) === setId);
}

export function isWordEnabledInTestModes(word) {
  return Boolean(word && word.usedInTest === true);
}

import { normalizeId, normalizePos } from "./word-normalizer.js?v=13.12";

const PRIORITY_POS = ["noun", "verb", "adjective", "adverb"];
const PRIORITY_POS_SET = new Set(PRIORITY_POS);

export function uniq(values) {
  return Array.from(new Set(values));
}

export function sortNatural(a, b) {
  return String(a).localeCompare(String(b), "ru", { numeric: true, sensitivity: "base" });
}

export function shuffle(values) {
  const array = values;
  for (let index = array.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [array[index], array[randomIndex]] = [array[randomIndex], array[index]];
  }
  return array;
}

function dictionaryId(word) {
  return String(word?.dictionary_id || word?.dict || "").trim();
}

function sourceSetId(word) {
  return String(word?.set_id || word?.set || "").trim();
}

export function dictsFrom(words) {
  return uniq(words.map(dictionaryId).filter(Boolean)).sort(sortNatural);
}

// Since 13.12 a dictionary is the only grouping level above a set. Keep this
// compatibility helper for existing screens until their route shape is direct
// dictionary -> set; it returns exactly the dictionary itself, never a second
// content hierarchy from the database.
export function sectionsFrom(words, dict) {
  return words.some((word) => dictionaryId(word) === String(dict || "").trim()) ? [String(dict || "").trim()] : [];
}

function orderedDictionaryWords(words, dict) {
  const dictionary = String(dict || "").trim();
  return words.filter((word) => dictionaryId(word) === dictionary)
    .sort((left, right) => Number(left.global_order || left.dict_order || 0) - Number(right.global_order || right.dict_order || 0));
}

export function setsFrom(words, dict) {
  const named = new Map();
  orderedDictionaryWords(words, dict).forEach((word) => {
    const id = sourceSetId(word);
    if (!id) return;
    const order = Number(word.global_order || word.dict_order || Number.MAX_SAFE_INTEGER);
    named.set(id, Math.min(named.get(id) ?? Number.MAX_SAFE_INTEGER, order));
  });
  return Array.from(named.entries())
    .map(([id, order]) => ({ id, order }))
    .sort((left, right) => left.order - right.order || sortNatural(left.id, right.id))
    .map((item) => item.id);
}

export function wordsForSet(words, dict, _section, setNumber) {
  const setId = String(setNumber || "").trim();
  if (!setId) return [];
  return orderedDictionaryWords(words, dict).filter((word) => sourceSetId(word) === setId);
}

export function isWordEnabledInTestModes(word) {
  return Boolean(word && word.usedInTest === true);
}

export function splitGroups(text) {
  return String(text || "")
    .split(/\s*[;；]\s*|\n+/g)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.replace(/^\s*\d+\s*(?:[.)]|[-–—])\s*/, "").trim());
}

function randomFrom(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function getTranslationSet(item) {
  return new Set(splitGroups(item?.trans).map((value) => value.toLowerCase()).filter(Boolean));
}

function getSynonymSet(item) {
  return new Set((Array.isArray(item?.synonyms) ? item.synonyms : [])
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean));
}

export function hasWordConflict(candidate, selected) {
  const translations = getTranslationSet(candidate);
  const synonyms = getSynonymSet(candidate);

  return selected.some((item) => {
    if (!item) return false;
    const itemTranslations = getTranslationSet(item);
    for (const translation of translations) {
      if (itemTranslations.has(translation)) return true;
    }
    const itemSynonyms = getSynonymSet(item);
    for (const synonym of synonyms) {
      if (itemSynonyms.has(synonym)) return true;
    }
    return false;
  });
}

export function buildRoundPOSList(globalPool, roundsCount) {
  const allPOS = uniq(globalPool.map((word) => normalizePos(word.pos)).filter(Boolean));
  const priorityPOS = allPOS.filter((pos) => PRIORITY_POS_SET.has(pos));
  const otherPOS = allPOS.filter((pos) => !PRIORITY_POS_SET.has(pos));
  const otherRoundsCount = Math.min(roundsCount, Math.round(roundsCount * 0.1));
  const priorityRoundsCount = roundsCount - otherRoundsCount;
  const roundPOSList = [];

  for (let index = 0; index < priorityRoundsCount; index += 1) {
    const fallback = otherPOS.length ? otherPOS : PRIORITY_POS;
    roundPOSList.push(randomFrom(priorityPOS.length ? priorityPOS : fallback));
  }
  for (let index = 0; index < otherRoundsCount; index += 1) {
    roundPOSList.push(randomFrom(otherPOS.length ? otherPOS : (priorityPOS.length ? priorityPOS : PRIORITY_POS)));
  }
  return shuffle(roundPOSList);
}

export function buildWordsByPOSRounds(globalPool, totalLimit) {
  const roundsCount = Math.max(1, Math.floor(totalLimit / 5));
  const roundPOSList = buildRoundPOSList(globalPool, roundsCount);
  const usedWords = new Set();
  const rounds = [];

  for (const targetPOS of roundPOSList) {
    const roundWords = [];
    const maxAttempts = globalPool.length * 5;
    let attempts = 0;

    while (roundWords.length < 5 && attempts < maxAttempts) {
      attempts += 1;
      const word = randomFrom(globalPool);
      if (!word) break;
      if (normalizePos(word.pos) !== targetPOS) continue;
      const id = normalizeId(word.id);
      if (!id || usedWords.has(id) || hasWordConflict(word, roundWords)) continue;
      roundWords.push(word);
      usedWords.add(id);
    }
    rounds.push(roundWords);
  }

  return { roundPOSList, rounds, items: rounds.flat() };
}

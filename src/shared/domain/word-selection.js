import { normalizeId, normalizePos } from "./word-normalizer.js";

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

export function dictsFrom(words) {
  return uniq(words.map((word) => word.dict)).sort(sortNatural);
}

export function sectionsFrom(words, dict) {
  return uniq(words.filter((word) => word.dict === dict).map((word) => word.section)).sort(sortNatural);
}

export function setsFrom(words, dict, section) {
  return uniq(words.filter((word) => word.dict === dict && word.section === section).map((word) => word.set)).sort(sortNatural);
}

export function wordsForSet(words, dict, section, setNumber) {
  return words.filter((word) => word.dict === dict && word.section === section && String(word.set) === String(setNumber));
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

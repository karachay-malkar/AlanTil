import type { MobileWord } from '@/src/mobile/dictionary';
import type { UserSettings } from '@/src/mobile/settings';
import { displayedAlanWord, displayedStructureName, displayedTranslation } from '@/src/mobile/dictionary';

export type PracticeWord = {
  id: string;
  word: string;
  trans: string;
  pos: string;
  synonyms: string[];
  dictionary_id: string;
  dictionary_name: string;
  section_id: string;
  section_name: string;
  set_id: string;
  source: MobileWord;
};

const PRIORITY_POS = ['noun', 'verb', 'adjective', 'adverb'];
const PRIORITY_POS_SET = new Set(PRIORITY_POS);

export function normalizeId(value: unknown) {
  return String(value ?? '').trim();
}

export function normalizePos(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

export function parseSynonyms(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((entry) => normalizeId(entry).toLowerCase()).filter(Boolean);
  return String(value ?? '').toLowerCase().split(',').map((entry) => entry.trim()).filter(Boolean);
}

export function splitGroups(value: unknown) {
  return String(value ?? '')
    .split(/\s*[;；]\s*|\n+/g)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.replace(/^\s*\d+\s*(?:[.)]|[-–—])\s*/, '').trim());
}

export function shuffle<T>(values: T[]): T[] {
  const array = values;
  for (let index = array.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [array[index], array[randomIndex]] = [array[randomIndex], array[index]];
  }
  return array;
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function randomFrom<T>(values: T[]) {
  return values[Math.floor(Math.random() * values.length)];
}

function translationSet(item: PracticeWord) {
  return new Set(splitGroups(item.trans).map((entry) => entry.toLowerCase()));
}

function synonymSet(item: PracticeWord) {
  return new Set(item.synonyms.map((entry) => entry.toLowerCase()).filter(Boolean));
}

export function hasWordConflict(candidate: PracticeWord, selected: PracticeWord[]) {
  const translations = translationSet(candidate);
  const synonyms = synonymSet(candidate);
  return selected.some((item) => {
    const itemTranslations = translationSet(item);
    for (const translation of translations) if (itemTranslations.has(translation)) return true;
    const itemSynonyms = synonymSet(item);
    for (const synonym of synonyms) if (itemSynonyms.has(synonym)) return true;
    return false;
  });
}

export function toPracticeWord(word: MobileWord, settings: UserSettings): PracticeWord | null {
  const id = normalizeId(word.word_id);
  const alan = displayedAlanWord(word, settings);
  const trans = displayedTranslation(word, settings);
  const dictionaryId = normalizeId(word.dictionary_id);
  const sectionId = normalizeId(word.section_id);
  const setId = normalizeId(word.set_id);
  if (!id || !alan || !trans || !dictionaryId || !sectionId || !setId) return null;
  return {
    id,
    word: alan,
    trans,
    pos: normalizePos(word.pos),
    synonyms: parseSynonyms(word.synonyms),
    dictionary_id: dictionaryId,
    dictionary_name: displayedStructureName(word, 'dictionary_name', settings) || dictionaryId,
    section_id: sectionId,
    section_name: displayedStructureName(word, 'section_name', settings) || sectionId,
    set_id: setId,
    source: word,
  };
}

export function buildRoundPOSList(pool: PracticeWord[], roundsCount: number) {
  const allPOS = unique(pool.map((word) => normalizePos(word.pos)).filter(Boolean));
  const priorityPOS = allPOS.filter((pos) => PRIORITY_POS_SET.has(pos));
  const otherPOS = allPOS.filter((pos) => !PRIORITY_POS_SET.has(pos));
  const otherRoundsCount = Math.min(roundsCount, Math.round(roundsCount * 0.1));
  const priorityRoundsCount = roundsCount - otherRoundsCount;
  const result: string[] = [];
  for (let index = 0; index < priorityRoundsCount; index += 1) {
    const fallback = otherPOS.length ? otherPOS : PRIORITY_POS;
    result.push(randomFrom(priorityPOS.length ? priorityPOS : fallback));
  }
  for (let index = 0; index < otherRoundsCount; index += 1) {
    result.push(randomFrom(otherPOS.length ? otherPOS : (priorityPOS.length ? priorityPOS : PRIORITY_POS)));
  }
  return shuffle(result);
}

export function buildWordsByPOSRounds(pool: PracticeWord[], totalLimit: number) {
  const roundsCount = Math.max(1, Math.floor(totalLimit / 5));
  const roundPOSList = buildRoundPOSList(pool, roundsCount);
  const usedWords = new Set<string>();
  const rounds: PracticeWord[][] = [];
  for (const targetPOS of roundPOSList) {
    const roundWords: PracticeWord[] = [];
    const maxAttempts = pool.length * 5;
    let attempts = 0;
    while (roundWords.length < 5 && attempts < maxAttempts) {
      attempts += 1;
      const word = randomFrom(pool);
      if (!word) break;
      if (normalizePos(word.pos) !== targetPOS) continue;
      if (!word.id || usedWords.has(word.id) || hasWordConflict(word, roundWords)) continue;
      roundWords.push(word);
      usedWords.add(word.id);
    }
    rounds.push(roundWords);
  }
  return { roundPOSList, rounds, items: rounds.flat() };
}

export type ScopeSection = { id: string; name: string; count: number };
export type ScopeDictionary = { id: string; name: string; count: number; sections: ScopeSection[] };

export function buildScope(words: PracticeWord[]): ScopeDictionary[] {
  const dictionaries = new Map<string, { id: string; name: string; count: number; sections: Map<string, ScopeSection> }>();
  words.forEach((word) => {
    if (!dictionaries.has(word.dictionary_id)) {
      dictionaries.set(word.dictionary_id, { id: word.dictionary_id, name: word.dictionary_name, count: 0, sections: new Map() });
    }
    const dictionary = dictionaries.get(word.dictionary_id)!;
    dictionary.count += 1;
    if (!dictionary.sections.has(word.section_id)) {
      dictionary.sections.set(word.section_id, { id: word.section_id, name: word.section_name, count: 0 });
    }
    dictionary.sections.get(word.section_id)!.count += 1;
  });
  return Array.from(dictionaries.values()).map((entry) => ({ ...entry, sections: Array.from(entry.sections.values()) }));
}

export function scopeKey(dictionaryId: string, sectionId: string) {
  return `${dictionaryId}||${sectionId}`;
}

export function buildSelectedSources(words: PracticeWord[]) {
  const grouped = new Map<string, Set<string>>();
  words.forEach((word) => {
    if (!grouped.has(word.dictionary_id)) grouped.set(word.dictionary_id, new Set());
    grouped.get(word.dictionary_id)!.add(word.section_id);
  });
  return Array.from(grouped.entries()).map(([dictionary_id, sections]) => ({ dictionary_id, section_ids: Array.from(sections) }));
}

import type { MobileWord } from '@/src/mobile/dictionary';
import type { UserSettings } from '@/src/mobile/settings';
import { displayedAlanWord, displayedStructureName, displayedTranslation } from '@/src/mobile/dictionary';
import {
  buildRoundPOSList,
  buildWordsByPOSRounds,
  hasWordConflict,
  normalizeId,
  normalizePos,
  shuffle,
  splitGroups,
} from '../../../../packages/alantil-core/practice.js';

export {
  buildRoundPOSList,
  buildWordsByPOSRounds,
  hasWordConflict,
  normalizeId,
  normalizePos,
  shuffle,
  splitGroups,
};

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

export function parseSynonyms(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((entry) => normalizeId(entry).toLowerCase()).filter(Boolean);
  return String(value ?? '').toLowerCase().split(',').map((entry) => entry.trim()).filter(Boolean);
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

import type { MobileWord } from '@/src/mobile/dictionary';
import type { UserSettings } from '@/src/mobile/settings';
import { displayedAlanWord, displayedStructureName, displayedTranslation } from '@/src/mobile/dictionary';
import {
  buildMatchRounds,
  buildRoundPOSList,
  buildSelectedSources,
  buildScope,
  buildTestWords,
  buildWordsByPOSRounds,
  hasWordConflict,
  normalizeId,
  normalizePos,
  parseSynonyms,
  scopeKey,
  shuffle,
  splitGroups,
} from '../../../../packages/alantil-core/practice.js';

export {
  buildMatchRounds,
  buildRoundPOSList,
  buildSelectedSources,
  buildScope,
  buildTestWords,
  buildWordsByPOSRounds,
  hasWordConflict,
  normalizeId,
  normalizePos,
  parseSynonyms,
  scopeKey,
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

export type ScopeSection = { id: string; name: string; count: number };
export type ScopeDictionary = { id: string; name: string; count: number; sections: ScopeSection[] };

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

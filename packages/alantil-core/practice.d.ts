export type CorePracticeWord = {
  id?: string;
  word_id?: string;
  word?: string;
  trans?: string;
  pos?: string;
  synonyms?: string[];
  dictionary_id?: string;
  dictionaryId?: string;
  dictionary_name?: string;
  section_id?: string;
  sectionId?: string;
  section_name?: string;
  set_id?: string;
  setId?: string;
  usedInTest?: boolean;
  global_order?: number;
  dict_order?: number;
  [key: string]: unknown;
};

export type BuildWordsOptions = {
  requireConflictFree?: boolean;
  allowConflictFallback?: boolean;
};

export type BuildWordsResult<T extends CorePracticeWord> = {
  roundPOSList: string[];
  rounds: T[][];
  items: T[];
  requestedLimit: number;
  effectiveLimit: number;
  complete: boolean;
};

export type ScopeSection = { id: string; name: string; count: number };
export type ScopeDictionary = { id: string; name: string; count: number; sections: ScopeSection[] };

export function normalizeId(value: unknown): string;
export function normalizePos(value: unknown): string;
export function parseSynonyms(value: unknown): string[];
export function sortNatural(a: unknown, b: unknown): number;
export function uniq<T>(values: T[]): T[];
export function shuffle<T>(values: T[]): T[];
export function splitGroups(value: unknown): string[];
export function dictsFrom<T extends CorePracticeWord>(words: T[]): string[];
export function sectionsFrom<T extends CorePracticeWord>(words: T[], dict: unknown): string[];
export function setsFrom<T extends CorePracticeWord>(words: T[], dict: unknown, section?: unknown): string[];
export function wordsForSection<T extends CorePracticeWord>(words: T[], dict: unknown, section: unknown): T[];
export function wordsForSet<T extends CorePracticeWord>(words: T[], dict: unknown, section: unknown, setNumber: unknown): T[];
export function isWordEnabledInTestModes(word: CorePracticeWord): boolean;
export function scopeKey(dictionaryId: unknown, sectionId: unknown): string;
export function buildScope<T extends CorePracticeWord>(words: T[]): ScopeDictionary[];
export function buildSelectedSources<T extends CorePracticeWord>(words: T[]): { dictionary_id: string; section_ids: string[] }[];
export function hasWordConflict<T extends CorePracticeWord>(candidate: T, selected: T[]): boolean;
export function buildRoundPOSList<T extends CorePracticeWord>(pool: T[], roundsCount: number): string[];
export function buildWordsByPOSRounds<T extends CorePracticeWord>(pool: T[], totalLimit: number, options?: BuildWordsOptions): BuildWordsResult<T>;
export function buildTestOptions<T extends CorePracticeWord>(item: T, optionPool: T[], mode?: "kb" | "ru", count?: number): { id: string; text: string }[];
export function buildTestWords<T extends CorePracticeWord>(pool: T[], totalLimit: number): BuildWordsResult<T>;
export function buildMatchRounds<T extends CorePracticeWord>(pool: T[], totalLimit: number): BuildWordsResult<T>;

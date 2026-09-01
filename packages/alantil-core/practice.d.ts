export type CorePracticeWord = {
  id?: string;
  word_id?: string;
  word?: string;
  trans?: string;
  pos?: string;
  synonyms?: string[];
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

export function normalizeId(value: unknown): string;
export function normalizePos(value: unknown): string;
export function uniq<T>(values: T[]): T[];
export function shuffle<T>(values: T[]): T[];
export function splitGroups(value: unknown): string[];
export function hasWordConflict<T extends CorePracticeWord>(candidate: T, selected: T[]): boolean;
export function buildRoundPOSList<T extends CorePracticeWord>(pool: T[], roundsCount: number): string[];
export function buildWordsByPOSRounds<T extends CorePracticeWord>(pool: T[], totalLimit: number, options?: BuildWordsOptions): BuildWordsResult<T>;

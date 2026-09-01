import type { CorePracticeWord } from './practice.js';

export type PracticeLimit = 20 | 40 | 80;
export type TestMode = 'kb' | 'ru';
export type SelectedSource = { dictionary_id: string; section_ids: string[] };
export type TestAnswerOption = { id: string; text: string };
export type TestResult = {
  id: string;
  questionText: string;
  word: string;
  trans: string;
  correctAnswer: string;
  userAnswer: string;
  wrongWordId: string | null;
  isCorrect: boolean;
};

export type CoreTestSessionState<T extends CorePracticeWord = CorePracticeWord, R = unknown> = {
  runtime: R;
  mode: TestMode;
  limit: number;
  items: T[];
  optionPool: T[];
  index: number;
  correct: number;
  results: TestResult[];
  selectedSources: SelectedSource[];
};

export type MatchErrorPair = { word_id_a: string; word_id_b: string; error_count: number };
export type CoreMatchSessionState<T extends CorePracticeWord = CorePracticeWord, R = unknown> = {
  runtime: R;
  limit: number;
  items: T[];
  rounds: T[][];
  roundIndex: number;
  solved: Set<string>;
  shown: Set<string>;
  failMap: Record<string, number>;
  errorPairs: Record<string, MatchErrorPair>;
  errorsCount: number;
  selectedSources: SelectedSource[];
};

export const PRACTICE_LIMITS: readonly PracticeLimit[];
export function normalizePracticeLimit(value: unknown, fallback?: number): number;
export function normalizeTestMode(value: unknown): TestMode;
export function createTestSessionState<T extends CorePracticeWord, R = unknown>(args?: {
  pool?: T[];
  optionPool?: T[];
  mode?: TestMode;
  limit?: number;
  selectedSources?: SelectedSource[];
  runtime?: R;
}): CoreTestSessionState<T, R>;
export function buildTestSessionOptions<T extends CorePracticeWord>(state: CoreTestSessionState<T, unknown>, item: T, count?: number): TestAnswerOption[];
export function submitTestAnswer<T extends CorePracticeWord, R>(state: CoreTestSessionState<T, R>, answer: TestAnswerOption): { result: TestResult; state: CoreTestSessionState<T, R> } | null;
export function testSessionSummary(state: Partial<CoreTestSessionState>): { total: number; correct: number; wrong: number; percentage: number; level: number };
export function testSessionPayload(state: Partial<CoreTestSessionState> | null, options?: { includeSnapshot?: boolean }): Record<string, unknown>;
export function restoreTestSessionState<T extends CorePracticeWord, R>(runtime: R, snapshot: Record<string, unknown> | null | undefined, words: T[]): CoreTestSessionState<T, R> | null;
export function restartTestSessionState<T extends CorePracticeWord, R>(state: CoreTestSessionState<T, R> | null, runtime?: R): CoreTestSessionState<T, R> | null;

export function createMatchSessionState<T extends CorePracticeWord, R = unknown>(args?: {
  pool?: T[];
  limit?: number;
  selectedSources?: SelectedSource[];
  runtime?: R;
}): CoreMatchSessionState<T, R>;
export function matchTranslationOptions<T extends CorePracticeWord>(round: T[]): TestAnswerOption[];
export function applyMatchPair<T extends CorePracticeWord, R>(state: CoreMatchSessionState<T, R>, firstId: unknown, secondId: unknown): { correct: boolean; wrongIds: string[]; state: CoreMatchSessionState<T, R> } | null;
export function advanceMatchRound<T extends CorePracticeWord, R>(state: CoreMatchSessionState<T, R>): { state: CoreMatchSessionState<T, R>; advanced: boolean; completed: boolean };
export function matchSessionPayload(state: Partial<CoreMatchSessionState> | null, options?: { includeSnapshot?: boolean }): Record<string, unknown>;
export function restoreMatchSessionState<T extends CorePracticeWord, R>(runtime: R, snapshot: Record<string, unknown> | null | undefined, words: T[]): CoreMatchSessionState<T, R> | null;
export function matchSessionSummary<T extends CorePracticeWord>(state: Partial<CoreMatchSessionState<T>>): { total: number; solved: number; errors: number; clean: number; problemWords: T[] };

import type { PracticeWord } from '@/src/mobile/practice/selection';
import type { SessionRuntime } from '@/src/mobile/practice/repository';

export type TestMode = 'kb' | 'ru';
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

export type TestSessionState = {
  runtime: SessionRuntime;
  mode: TestMode;
  limit: number;
  items: PracticeWord[];
  optionPool: PracticeWord[];
  index: number;
  correct: number;
  results: TestResult[];
  selectedSources: { dictionary_id: string; section_ids: string[] }[];
};

export type MatchSessionState = {
  runtime: SessionRuntime;
  limit: number;
  items: PracticeWord[];
  rounds: PracticeWord[][];
  roundIndex: number;
  solved: Set<string>;
  shown: Set<string>;
  failMap: Record<string, number>;
  errorPairs: Record<string, { word_id_a: string; word_id_b: string; error_count: number }>;
  errorsCount: number;
  selectedSources: { dictionary_id: string; section_ids: string[] }[];
};

let testSession: TestSessionState | null = null;
let matchSession: MatchSessionState | null = null;

export function getTestSession() { return testSession; }
export function setTestSession(value: TestSessionState | null) { testSession = value; }
export function getMatchSession() { return matchSession; }
export function setMatchSession(value: MatchSessionState | null) { matchSession = value; }

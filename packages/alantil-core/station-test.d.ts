export type StationTestWord = {
  id: string;
  word?: string;
  trans?: string;
  pos?: string;
  synonyms?: string[] | string;
  [key: string]: unknown;
};

export type StationTestAnswer = { word_id: string; result: 'correct' | 'wrong'; wrong_word_id: string | null };
export type StationTestState = {
  ids: string[];
  index: number;
  answers: StationTestAnswer[];
  direction: 'alan_ru' | 'ru_alan';
  phase: string;
};

export declare function normalizedLexeme(value: unknown): string;
export declare function approximateStem(value: unknown): string;
export declare function stationTestCandidateIsAmbiguous<T extends StationTestWord>(candidate: T, item: T, selected?: T[]): boolean;
export declare function stationTestDistractors<T extends StationTestWord>(item: T, allWords: T[], count?: number): T[];
export declare function buildStationTestOptions<T extends StationTestWord>(item: T, allWords: T[], mode?: string, count?: number): { id: string; text: string; word: T }[];
export declare function buildStationTestQuestion<T extends StationTestWord>(item: T, allWords: T[], mode?: string, count?: number): { item: T; options: { id: string; text: string; word: T }[] };
export declare function stationTestSelectionSignature<T extends StationTestWord>(words: T[]): string;
export declare function stationTestAccuracy(answers: any[], questionsTotal?: number): number;
export declare function stationTestMasteryLevel(accuracy: number): 0 | 1 | 2 | 3;
export declare function stationTestResult(answers: any[], requiredAccuracy?: number, questionsTotal?: number): { accuracy: number; required: number; passed: boolean; masteryLevel: 0 | 1 | 2 | 3 };
export declare function normalizeStationTestDirection(value: unknown): 'alan_ru' | 'ru_alan';
export declare function createStationTestState<T extends StationTestWord>(words: T[], direction?: unknown, phase?: unknown): StationTestState;
export declare function restoreStationTestState<T extends StationTestWord>(snapshot: Record<string, any> | null | undefined, words: T[]): StationTestState | null;
export declare function submitStationTestAnswer(state: StationTestState, itemId: unknown, selectedId: unknown): { answer: StationTestAnswer; state: StationTestState } | null;
export declare function stationTestSessionPayload(state: StationTestState | null, station: Record<string, any> | null, requiredAccuracy?: number): Record<string, any>;
export declare function restartStationTestState<T extends StationTestWord>(previousState: StationTestState | null, words: T[], phase?: unknown): StationTestState;

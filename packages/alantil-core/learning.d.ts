export type LearnEntry = {
  word_id: string;
  show_count: number;
  left_swipe_count: number;
  final_result: 'known' | 'unfinished';
  first_position: number;
};

export type LearnSnapshot = {
  index: number;
  repeatIds: string[];
  entries: Record<string, LearnEntry>;
};

export type LearnState = {
  source: 'station' | 'favorites';
  ids: string[];
  index: number;
  repeatIds: string[];
  entries: Record<string, LearnEntry>;
  direction: 'alan_ru' | 'ru_alan';
  undo?: LearnSnapshot | null;
  undo_count?: number;
  [key: string]: unknown;
};

export declare function cloneLearnValue<T>(value: T): T;
export declare function captureLearnActionSnapshot(state: any): any;
export declare function restoreLearnActionSnapshot(state: any, snapshot: any): any;
export declare function entryFor(state: LearnState, wordId: string): LearnEntry;
export declare function learnQueue(state: LearnState): string[];
export declare function applyLearnDecision(state: LearnState, wordId: string, known: boolean): LearnState;
export declare function undoLearnDecision(state: LearnState): LearnState | null;
export declare function splitMeaningGroups(value: unknown): string[];
export declare function learningSessionWords(entries: Record<string, LearnEntry>): LearnEntry[];
export declare function learningSessionSummary(entries: Record<string, LearnEntry>, words?: any[]): {
  studiedTotal: number;
  knownTotal: number;
  unknownTotal: number;
  leftSwipesTotal: number;
  unfinishedTotal: number;
  problemWords: any[];
  rows: LearnEntry[];
};
export declare function learningSessionPayload(state: any, scope?: Record<string, unknown>): Record<string, unknown> & { words: LearnEntry[] };

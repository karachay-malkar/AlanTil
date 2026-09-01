export type StationTestWord = {
  id: string;
  word?: string;
  trans?: string;
  pos?: string;
  synonyms?: string[] | string;
  [key: string]: unknown;
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

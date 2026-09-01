export type StatisticsProblemWord<T> = {
  word: T;
  progress: Record<string, unknown>;
  evaluated: number;
  shows: number;
  errors: number;
  unknownRate: number;
  difficulty: number;
};

export type ProfileStatistics<T> = {
  masteredWords: number;
  completedDictionaries: number;
  activeSeconds: number;
  learnSessions: number;
  accuracy: number;
  reviewWords: number;
  problemWords: StatisticsProblemWord<T>[];
};

export function summarizeActivityHistory(rows?: readonly Record<string, unknown>[]): {
  sessionsTotal: number;
  learnSessions: number;
  testAttempts: number;
  matchSessions: number;
  sessionsCompleted: number;
  activeSeconds: number;
  accuracy: number;
  leftSwipes: number;
  problemWordIds: string[];
  recent: Record<string, unknown>[];
};
export function buildProblemWordRows<T>(words?: readonly T[], progressById?: Map<string, Record<string, unknown>> | readonly Record<string, unknown>[], limit?: number): StatisticsProblemWord<T>[];
export function countCompletedDictionaries<T>(words?: readonly T[], progressById?: Map<string, Record<string, unknown>> | readonly Record<string, unknown>[]): number;
export function buildProfileStatistics<T>(words?: readonly T[], progressRows?: readonly Record<string, unknown>[], historyRows?: readonly Record<string, unknown>[], problemLimit?: number): ProfileStatistics<T>;

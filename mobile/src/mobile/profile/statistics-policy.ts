import {
  buildProfileStatistics as buildSharedProfileStatistics,
  type ProfileStatistics as SharedProfileStatistics,
  type StatisticsProblemWord as SharedStatisticsProblemWord,
} from '../../../../packages/alantil-core/statistics.js';

export type StatisticsWord = {
  word_id: string;
  story_id?: string | null;
  dictionary_id?: string | null;
};

export type StatisticsProblemWord<T extends StatisticsWord> = SharedStatisticsProblemWord<T>;
export type ProfileStatistics<T extends StatisticsWord> = SharedProfileStatistics<T>;

export function buildProfileStatistics<T extends StatisticsWord>(
  words: readonly T[],
  progressRows: readonly Record<string, unknown>[],
  historyRows: readonly Record<string, unknown>[],
  problemLimit = 12,
): ProfileStatistics<T> {
  return buildSharedProfileStatistics(words, progressRows, historyRows, problemLimit);
}

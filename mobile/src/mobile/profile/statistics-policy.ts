export type StatisticsWord = {
  word_id: string;
  story_id?: string | null;
  dictionary_id?: string | null;
};

export type StatisticsProblemWord<T extends StatisticsWord> = {
  word: T;
  shows: number;
  errors: number;
  difficulty: number;
};

export type ProfileStatistics<T extends StatisticsWord> = {
  masteredWords: number;
  completedDictionaries: number;
  activeSeconds: number;
  learnSessions: number;
  accuracy: number;
  reviewWords: number;
  problemWords: StatisticsProblemWord<T>[];
};

function text(value: unknown) {
  return String(value ?? '').trim();
}

function count(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function mastered(row: Record<string, unknown> | undefined) {
  return ['mastered', 'review'].includes(text(row?.mastery_status));
}

export function buildProfileStatistics<T extends StatisticsWord>(
  words: readonly T[],
  progressRows: readonly Record<string, unknown>[],
  historyRows: readonly Record<string, unknown>[],
  problemLimit = 12,
): ProfileStatistics<T> {
  const uniqueById = new Map<string, T>();
  words.forEach((word) => {
    const wordId = text(word.word_id);
    if (wordId) uniqueById.set(wordId, word);
  });
  const uniqueWords = Array.from(uniqueById.values());
  const progress = new Map<string, Record<string, unknown>>();
  progressRows.forEach((row) => {
    const wordId = text(row.word_id);
    if (wordId) progress.set(wordId, row);
  });
  const catalogs = new Map<string, Set<string>>();
  uniqueWords.forEach((word) => {
    const storyId = text(word.story_id);
    const dictionaryId = text(word.dictionary_id);
    if (!storyId || !dictionaryId) return;
    const key = `${storyId}::${dictionaryId}`;
    const ids = catalogs.get(key) ?? new Set<string>();
    ids.add(text(word.word_id));
    catalogs.set(key, ids);
  });

  const masteredWords = uniqueWords.filter((word) => mastered(progress.get(text(word.word_id)))).length;
  const reviewWords = uniqueWords.filter((word) => text(progress.get(text(word.word_id))?.mastery_status) === 'review').length;
  const completedDictionaries = Array.from(catalogs.values()).filter((ids) => {
    return ids.size > 0 && Array.from(ids).every((wordId) => mastered(progress.get(wordId)));
  }).length;
  const activeSeconds = historyRows.reduce((sum, row) => sum + count(row.active_duration_sec), 0);
  const learnSessions = historyRows.filter((row) => text(row.type) === 'learn').length;
  const correct = historyRows.reduce((sum, row) => sum + count(row.correct_total ?? row.correct_count), 0);
  const wrong = historyRows.reduce((sum, row) => sum + count(row.wrong_total ?? row.wrong_count), 0);

  const problemWords = uniqueWords.map((word): StatisticsProblemWord<T> => {
    const row: Record<string, unknown> = progress.get(text(word.word_id)) ?? {};
    const shows = Math.max(count(row.study_shown_count), count(row.learn_shows_total));
    const unknown = Math.max(count(row.unknown_count), count(row.learn_left_swipes_total));
    const testWrong = Math.max(count(row.test_wrong_count), count(row.test_wrong_total));
    return {
      word,
      shows,
      errors: unknown + testWrong,
      difficulty: shows ? Math.round((unknown / shows) * 100) : 0,
    };
  }).filter((entry) => entry.errors > 0)
    .sort((left, right) => right.difficulty - left.difficulty || right.errors - left.errors || right.shows - left.shows)
    .slice(0, Math.max(1, problemLimit));

  return {
    masteredWords,
    completedDictionaries,
    activeSeconds,
    learnSessions,
    accuracy: correct + wrong ? Math.round((correct / (correct + wrong)) * 100) : 0,
    reviewWords,
    problemWords,
  };
}

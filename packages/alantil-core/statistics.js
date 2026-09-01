import { summarizeWordProgress } from './progress.js';

function text(value) {
  return String(value ?? '').normalize('NFC').trim();
}

function count(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function progressMapFromRows(rows = []) {
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const id = text(row?.word_id ?? row?.id);
    if (id) map.set(id, row);
  });
  return map;
}

export function summarizeActivityHistory(rows = []) {
  const history = Array.isArray(rows) ? rows : [];
  const completed = history.filter((row) => row?.status === 'completed');
  const activeSeconds = history.reduce((sum, row) => sum + count(row?.active_duration_sec), 0);
  const testCorrect = history.reduce((sum, row) => sum + count(row?.correct_total ?? row?.correct_count), 0);
  const testWrong = history.reduce((sum, row) => sum + count(row?.wrong_total ?? row?.wrong_count), 0);
  const difficult = new Map();
  history.forEach((row) => {
    (Array.isArray(row?.words) ? row.words : []).forEach((word) => {
      const wrong = word?.result === 'wrong' || count(word?.left_swipe_count) > 0;
      if (!wrong) return;
      const id = text(word?.word_id);
      if (id) difficult.set(id, (difficult.get(id) || 0) + 1);
    });
  });
  return {
    sessionsTotal: history.length,
    learnSessions: history.filter((row) => row?.type === 'learn').length,
    testAttempts: history.filter((row) => ['test', 'station_test'].includes(row?.type)).length,
    matchSessions: history.filter((row) => row?.type === 'match').length,
    sessionsCompleted: completed.length,
    activeSeconds,
    accuracy: testCorrect + testWrong ? Math.round((testCorrect / (testCorrect + testWrong)) * 100) : 0,
    leftSwipes: history.reduce((sum, row) => sum + count(row?.left_swipes_total), 0),
    problemWordIds: Array.from(difficult.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 12)
      .map(([id]) => id),
    recent: history.slice(0, 8),
  };
}

export function buildProblemWordRows(words = [], progressById, limit = 7) {
  const map = typeof progressById?.get === 'function' ? progressById : progressMapFromRows(progressById);
  return (Array.isArray(words) ? words : [])
    .map((word) => {
      const id = text(word?.id ?? word?.word_id);
      const progress = map.get(id) || {};
      const shows = Math.max(count(progress.study_shown_count), count(progress.learn_shows_total));
      const unknown = Math.max(count(progress.unknown_count), count(progress.learn_left_swipes_total));
      const testWrong = Math.max(count(progress.test_wrong_count), count(progress.test_wrong_total));
      const unknownRate = shows ? Math.round((unknown / shows) * 100) : 0;
      return {
        word,
        progress,
        evaluated: shows,
        shows,
        errors: unknown + testWrong,
        unknownRate,
        difficulty: unknownRate,
      };
    })
    .filter((item) => item.errors > 0)
    .sort((left, right) => right.unknownRate - left.unknownRate
      || Math.max(count(right.progress.unknown_count), count(right.progress.learn_left_swipes_total)) - Math.max(count(left.progress.unknown_count), count(left.progress.learn_left_swipes_total))
      || Math.max(count(right.progress.test_wrong_count), count(right.progress.test_wrong_total)) - Math.max(count(left.progress.test_wrong_count), count(left.progress.test_wrong_total)))
    .slice(0, Math.max(1, Number(limit || 7)));
}

export function countCompletedDictionaries(words = [], progressById) {
  const map = typeof progressById?.get === 'function' ? progressById : progressMapFromRows(progressById);
  const dictionaries = new Map();
  (Array.isArray(words) ? words : []).forEach((word) => {
    const wordId = text(word?.id ?? word?.word_id);
    const storyId = text(word?.story_id ?? word?.storyId ?? word?.story_type);
    const dictionaryId = text(word?.dictionary_id ?? word?.dictionaryId ?? word?.catalog_id);
    if (!wordId || !storyId || !dictionaryId) return;
    const key = `${storyId}::${dictionaryId}`;
    if (!dictionaries.has(key)) dictionaries.set(key, new Set());
    dictionaries.get(key).add(wordId);
  });
  return Array.from(dictionaries.values()).filter((ids) => ids.size > 0 && Array.from(ids).every((id) => {
    const status = text(map.get(id)?.mastery_status);
    return status === 'mastered' || status === 'review';
  })).length;
}

export function buildProfileStatistics(words = [], progressRows = [], historyRows = [], problemLimit = 12) {
  const unique = new Map();
  (Array.isArray(words) ? words : []).forEach((word) => {
    const id = text(word?.id ?? word?.word_id);
    if (id) unique.set(id, word);
  });
  const uniqueWords = Array.from(unique.values());
  const progressMap = progressMapFromRows(progressRows);
  const mastery = summarizeWordProgress(uniqueWords, progressMap);
  const activity = summarizeActivityHistory(historyRows);
  return {
    masteredWords: mastery.mastered,
    completedDictionaries: countCompletedDictionaries(uniqueWords, progressMap),
    activeSeconds: activity.activeSeconds,
    learnSessions: activity.learnSessions,
    accuracy: activity.accuracy,
    reviewWords: mastery.review,
    problemWords: buildProblemWordRows(uniqueWords, progressMap, problemLimit),
  };
}

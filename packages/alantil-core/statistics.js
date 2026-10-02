export const ACTIVITY_HISTORY_LIMIT = 300;

export function activityHistoryEntry(type, payload) {
  if (!payload?.id) return null;
  return {
    id: payload.id,
    type: String(type || ''),
    status: payload.status,
    started_at: payload.started_at,
    ended_at: payload.ended_at,
    duration_sec: Number(payload.duration_sec || 0),
    active_duration_sec: Number(payload.active_duration_sec || 0),
    dictionary_id: payload.dictionary_id || null,
    section_id: payload.section_id || null,
    set_id: payload.set_id || null,
    correct_total: Number(payload.correct_total || payload.correct_count || 0),
    wrong_total: Number(payload.wrong_total || payload.wrong_count || 0),
    accuracy: Number(payload.accuracy ?? payload.score_percent ?? 0),
    left_swipes_total: Number(payload.left_swipes_total || 0),
    words: Array.isArray(payload.words) ? payload.words : [],
  };
}

export function upsertActivityHistory(rows = [], type, payload, limit = ACTIVITY_HISTORY_LIMIT) {
  const entry = activityHistoryEntry(type, payload);
  if (!entry) return { rows: Array.isArray(rows) ? rows : [], entry: null };
  const next = (Array.isArray(rows) ? rows : []).filter((row) => row.id !== payload.id);
  next.unshift(entry);
  next.sort((left, right) => Date.parse(right.ended_at || right.started_at || 0) - Date.parse(left.ended_at || left.started_at || 0));
  return { rows: next.slice(0, limit), entry };
}

export function summarizeActivityHistory(rows = []) {
  const history = Array.isArray(rows) ? rows : [];
  const completed = history.filter((row) => row.status === 'completed');
  const activeSeconds = history.reduce((sum, row) => sum + Math.max(0, Number(row.active_duration_sec || 0)), 0);
  const testCorrect = history.reduce((sum, row) => sum + Number(row.correct_total || 0), 0);
  const testWrong = history.reduce((sum, row) => sum + Number(row.wrong_total || 0), 0);
  const difficult = new Map();
  history.forEach((row) => {
    (row.words || []).forEach((word) => {
      const wrong = word.result === 'wrong' || Number(word.left_swipe_count || 0) > 0;
      if (!wrong) return;
      const id = String(word.word_id || '').trim();
      if (id) difficult.set(id, (difficult.get(id) || 0) + 1);
    });
  });
  return {
    sessionsTotal: history.length,
    learnSessions: history.filter((row) => row.type === 'learn').length,
    testAttempts: history.filter((row) => ['test', 'station_test'].includes(row.type)).length,
    matchSessions: history.filter((row) => row.type === 'match').length,
    sessionsCompleted: completed.length,
    activeSeconds,
    accuracy: testCorrect + testWrong ? Math.round((testCorrect / (testCorrect + testWrong)) * 100) : 0,
    leftSwipes: history.reduce((sum, row) => sum + Number(row.left_swipes_total || 0), 0),
    problemWordIds: Array.from(difficult.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([id]) => id),
    recent: history.slice(0, 8),
  };
}


function stationHistoryTime(row) {
  return Date.parse(row?.ended_at || row?.started_at || '') || 0;
}

function stationWordId(value) {
  return String(value ?? '').trim();
}

function stationSetId(station = {}) {
  return String(station.setId || station.sourceSetId || station.selectionSetId || '').trim();
}

function stationHistoryMatches(row, station = {}) {
  const setId = stationSetId(station);
  if (!setId || stationWordId(row?.set_id) !== setId || row?.status !== 'completed') return false;
  const dictionaryId = stationWordId(station.dictionaryId || station.catalogId);
  const sectionId = stationWordId(station.sectionId || station.groupId);
  if (dictionaryId && stationWordId(row?.dictionary_id) && stationWordId(row.dictionary_id) !== dictionaryId) return false;
  if (sectionId && stationWordId(row?.section_id) && stationWordId(row.section_id) !== sectionId) return false;
  return true;
}

function stationMetric(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
}

export function buildStationLearningStatistics(rows = [], station = {}) {
  const words = Array.isArray(station?.words) ? station.words : [];
  const wordById = new Map(words.map((word) => [stationWordId(word?.id), word]).filter(([id]) => id));
  const wordIds = new Set(wordById.keys());
  const history = (Array.isArray(rows) ? rows : [])
    .filter((row) => stationHistoryMatches(row, station))
    .sort((left, right) => stationHistoryTime(left) - stationHistoryTime(right));

  const completedLearn = history.filter((row) => row.type === 'learn');
  const completedTests = history.filter((row) => row.type === 'station_test');
  const seen = new Set();

  const learn = completedLearn.map((row) => {
    const sessionWords = (Array.isArray(row.words) ? row.words : [])
      .filter((entry) => wordIds.has(stationWordId(entry?.word_id)) && Number(entry?.show_count || 0) > 0);
    const eligible = sessionWords.filter((entry) => seen.has(stationWordId(entry.word_id)));
    const firstTry = eligible.filter((entry) => Number(entry.show_count || 0) === 1 && entry.final_result === 'known').length;
    const shows = sessionWords.reduce((sum, entry) => sum + Math.max(0, Number(entry.show_count || 0)), 0);
    const result = {
      id: row.id,
      date: row.ended_at || row.started_at || null,
      firstTryPercent: eligible.length ? Math.round((firstTry / eligible.length) * 100) : null,
      showsPerWord: sessionWords.length ? stationMetric(shows / sessionWords.length) : null,
      wordCount: sessionWords.length,
    };
    sessionWords.forEach((entry) => seen.add(stationWordId(entry.word_id)));
    return result;
  });

  const tests = completedTests.map((row) => {
    const correct = Math.max(0, Number(row.correct_total || 0));
    const wrong = Math.max(0, Number(row.wrong_total || 0));
    const total = correct + wrong;
    const storedAccuracy = Math.max(0, Math.min(100, Number(row.accuracy || 0)));
    return {
      id: row.id,
      date: row.ended_at || row.started_at || null,
      percent: total ? Math.round((correct / total) * 100) : Math.round(storedAccuracy),
      correct,
      total,
    };
  });

  const perWord = new Map(Array.from(wordById.keys(), (wordId) => [wordId, { shows: 0, learnSessions: 0, testErrors: 0 }]));
  completedLearn.forEach((row) => {
    (Array.isArray(row.words) ? row.words : []).forEach((entry) => {
      const wordId = stationWordId(entry?.word_id);
      const metric = perWord.get(wordId);
      const shows = Math.max(0, Number(entry?.show_count || 0));
      if (!metric || !shows) return;
      metric.shows += shows;
      metric.learnSessions += 1;
    });
  });
  completedTests.forEach((row) => {
    (Array.isArray(row.words) ? row.words : []).forEach((entry) => {
      const metric = perWord.get(stationWordId(entry?.word_id));
      if (metric && entry?.result === 'wrong') metric.testErrors += 1;
    });
  });

  const problems = Array.from(perWord.entries()).map(([wordId, metric]) => {
    const word = wordById.get(wordId) || {};
    const showsPerWord = metric.learnSessions ? stationMetric(metric.shows / metric.learnSessions) : 0;
    return { wordId, word: word.word || '', trans: word.trans || '', showsPerWord, testErrors: metric.testErrors };
  }).filter((row) => row.showsPerWord > 1 || row.testErrors > 0)
    .sort((left, right) => right.showsPerWord - left.showsPerWord || right.testErrors - left.testErrors || left.wordId.localeCompare(right.wordId));

  const timeline = [
    ...learn.map((row) => ({ ...row, type: 'learn' })),
    ...tests.map((row) => ({ ...row, type: 'station_test' })),
  ].sort((left, right) => stationHistoryTime({ ended_at: left.date }) - stationHistoryTime({ ended_at: right.date }));

  return { learn, tests, timeline, problems };
}

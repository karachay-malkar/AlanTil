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

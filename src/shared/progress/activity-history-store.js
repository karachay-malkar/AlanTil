import { readScopedJson, writeScopedJson } from "./storage-scope.js";

export const ACTIVITY_HISTORY_KEY = "alantil_activity_history_v13_1";
const LIMIT = 300;

export function getActivityHistory() {
  const rows = readScopedJson(ACTIVITY_HISTORY_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

export function recordActivitySession(type, payload) {
  if (!payload?.id) return null;
  const rows = getActivityHistory().filter((row) => row.id !== payload.id);
  const entry = {
    id: payload.id,
    type: String(type || ""),
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
  rows.unshift(entry);
  rows.sort((left, right) => Date.parse(right.ended_at || right.started_at || 0) - Date.parse(left.ended_at || left.started_at || 0));
  writeScopedJson(ACTIVITY_HISTORY_KEY, rows.slice(0, LIMIT));
  return entry;
}

export function activitySummary() {
  const rows = getActivityHistory();
  const completed = rows.filter((row) => row.status === "completed");
  const activeSeconds = rows.reduce((sum, row) => sum + Math.max(0, Number(row.active_duration_sec || 0)), 0);
  const testCorrect = rows.reduce((sum, row) => sum + Number(row.correct_total || 0), 0);
  const testWrong = rows.reduce((sum, row) => sum + Number(row.wrong_total || 0), 0);
  const difficult = new Map();
  rows.forEach((row) => {
    (row.words || []).forEach((word) => {
      const wrong = word.result === "wrong" || Number(word.left_swipe_count || 0) > 0;
      if (!wrong) return;
      const id = String(word.word_id || "").trim();
      if (id) difficult.set(id, (difficult.get(id) || 0) + 1);
    });
  });
  return {
    sessionsTotal: rows.length,
    sessionsCompleted: completed.length,
    activeSeconds,
    accuracy: testCorrect + testWrong ? Math.round((testCorrect / (testCorrect + testWrong)) * 100) : 0,
    leftSwipes: rows.reduce((sum, row) => sum + Number(row.left_swipes_total || 0), 0),
    problemWordIds: Array.from(difficult.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([id]) => id),
    recent: rows.slice(0, 8),
  };
}

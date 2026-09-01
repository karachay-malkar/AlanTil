import { readScopedJson, writeScopedJson } from "./storage-scope.js?v=13.9.0";
import { summarizeActivityHistory } from "../../../packages/alantil-core/statistics.js";

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
  return summarizeActivityHistory(getActivityHistory());
}

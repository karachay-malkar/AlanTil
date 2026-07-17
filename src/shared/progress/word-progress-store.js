import { getActivityHistory } from "./activity-history-store.js?v=13.8.1";
import { readScopedJson, writeScopedJson } from "./storage-scope.js?v=13.8.1";
import { awardReward } from "./reward-store.js?v=13.8.1";

export const WORD_PROGRESS_LOCAL_KEY = "alantil_word_progress_v13_5";
const MAX_PROCESSED_SESSIONS = 600;
const NUMERIC_FIELDS = Object.freeze([
  "sessions_total",
  "learn_sessions_total",
  "learn_unfinished_total",
  "test_answers_total",
  "match_sessions_total",
  "match_success_total",
  "match_errors_total",
  "study_shown_count",
  "known_count",
  "unknown_count",
  "test_correct_count",
  "test_wrong_count",
]);
const STATUS_RANK = Object.freeze({ not_started: 0, learning: 1, mastered: 2, review: 3 });

function normalizeId(value) {
  return String(value ?? "").trim();
}

function emptyRow(wordId) {
  return {
    word_id: normalizeId(wordId),
    sessions_total: 0,
    learn_sessions_total: 0,
    learn_unfinished_total: 0,
    test_answers_total: 0,
    match_sessions_total: 0,
    match_success_total: 0,
    match_errors_total: 0,
    study_shown_count: 0,
    known_count: 0,
    unknown_count: 0,
    test_correct_count: 0,
    test_wrong_count: 0,
    mastery_status: "not_started",
    mastered_at: null,
    last_mode: null,
    last_result: null,
    last_seen_at: null,
    last_studied_at: null,
    last_tested_at: null,
  };
}

function normalizeRow(row = {}, wordId = row.word_id) {
  const normalized = {
    ...emptyRow(wordId),
    ...row,
    word_id: normalizeId(wordId || row.word_id),
  };
  NUMERIC_FIELDS.forEach((key) => {
    normalized[key] = Math.max(0, Number(normalized[key] || 0));
  });
  if (!["not_started", "learning", "mastered", "review"].includes(normalized.mastery_status)) {
    normalized.mastery_status = normalized.mastered_at ? "mastered" : "not_started";
  }
  return normalized;
}

function readState() {
  const raw = readScopedJson(WORD_PROGRESS_LOCAL_KEY, {});
  const rows = raw?.rows && typeof raw.rows === "object" ? raw.rows : {};
  const processed = Array.isArray(raw?.processed_session_ids) ? raw.processed_session_ids : [];
  return { rows, processed_session_ids: processed };
}

function writeState(state) {
  writeScopedJson(WORD_PROGRESS_LOCAL_KEY, {
    rows: state.rows,
    processed_session_ids: state.processed_session_ids.slice(-MAX_PROCESSED_SESSIONS),
  });
}

function withMutableRow(state, wordId) {
  const id = normalizeId(wordId);
  if (!id) return null;
  state.rows[id] = normalizeRow(state.rows[id], id);
  return state.rows[id];
}

function markProcessed(state, sessionId) {
  const id = normalizeId(sessionId);
  if (!id) return true;
  if (state.processed_session_ids.includes(id)) return false;
  state.processed_session_ids.push(id);
  return true;
}

function laterIso(left, right) {
  const leftTime = Date.parse(left || "") || 0;
  const rightTime = Date.parse(right || "") || 0;
  return rightTime > leftTime ? right : left;
}

function strongerStatus(left, right) {
  const local = STATUS_RANK[left] === undefined ? "not_started" : left;
  const cloud = STATUS_RANK[right] === undefined ? "not_started" : right;
  return STATUS_RANK[cloud] > STATUS_RANK[local] ? cloud : local;
}

export function recordLearnWordResults(sessionId, words = [], completedAt = new Date().toISOString()) {
  const state = readState();
  if (!markProcessed(state, sessionId)) return false;
  (Array.isArray(words) ? words : []).forEach((entry) => {
    const row = withMutableRow(state, entry?.word_id);
    if (!row) return;
    row.sessions_total += 1;
    row.learn_sessions_total += 1;
    row.study_shown_count += Math.max(0, Number(entry.show_count || 0));
    row.unknown_count += Math.max(0, Number(entry.left_swipe_count || 0));
    if (entry.final_result === "known") row.known_count += 1;
    else row.learn_unfinished_total += 1;
    if (row.mastery_status === "not_started") row.mastery_status = "learning";
    row.last_mode = "learn";
    row.last_result = entry.final_result === "known" ? "known" : "unfinished";
    row.last_seen_at = completedAt;
    row.last_studied_at = completedAt;
  });
  writeState(state);
  return true;
}

export function recordTestWordResults({
  sessionId,
  answers = [],
  accuracy = 0,
  requiredAccuracy = 80,
  updateMastery = false,
  completedAt = new Date().toISOString(),
} = {}) {
  const state = readState();
  if (!markProcessed(state, sessionId)) return false;
  const passed = Number(accuracy || 0) >= Number(requiredAccuracy || 80);
  (Array.isArray(answers) ? answers : []).forEach((entry) => {
    const row = withMutableRow(state, entry?.word_id || entry?.wordId);
    if (!row) return;
    row.sessions_total += 1;
    row.test_answers_total += 1;
    const correct = entry.result === "correct" || entry.isCorrect === true;
    if (correct) row.test_correct_count += 1;
    else row.test_wrong_count += 1;
    if (updateMastery && passed && correct) {
      row.mastery_status = "mastered";
      row.mastered_at ||= completedAt;
    } else if (updateMastery && !correct && (row.mastered_at || ["mastered", "review"].includes(row.mastery_status))) {
      row.mastery_status = "review";
    } else if (row.mastery_status === "not_started") {
      row.mastery_status = "learning";
    }
    row.last_mode = "test";
    row.last_result = correct ? "correct" : "wrong";
    row.last_seen_at = completedAt;
    row.last_tested_at = completedAt;
  });
  writeState(state);
  if (updateMastery && passed) awardWordMilestones();
  return true;
}

export function recordMatchWordResults(sessionId, words = [], completedAt = new Date().toISOString()) {
  const state = readState();
  if (!markProcessed(state, sessionId)) return false;
  (Array.isArray(words) ? words : []).forEach((entry) => {
    const row = withMutableRow(state, entry?.word_id);
    if (!row) return;
    const matched = entry.matched === true;
    row.sessions_total += 1;
    row.match_sessions_total += 1;
    if (matched) row.match_success_total += 1;
    row.match_errors_total += Math.max(0, Number(entry.error_count || 0));
    if (row.mastery_status === "not_started") row.mastery_status = "learning";
    row.last_mode = "match";
    row.last_result = matched ? "matched" : "unfinished";
    row.last_seen_at = completedAt;
  });
  writeState(state);
  return true;
}

export function mergeCloudWordProgress(rows = []) {
  const state = readState();
  (Array.isArray(rows) ? rows : []).forEach((cloud) => {
    const row = withMutableRow(state, cloud?.word_id);
    if (!row) return;
    NUMERIC_FIELDS.forEach((field) => {
      row[field] = Math.max(row[field], Math.max(0, Number(cloud?.[field] || 0)));
    });
    row.mastery_status = strongerStatus(row.mastery_status, String(cloud.mastery_status || "not_started").trim());
    if (cloud.mastered_at) {
      row.mastered_at = row.mastered_at || cloud.mastered_at;
      if (row.mastery_status === "not_started") row.mastery_status = "mastered";
    }
    const localSeen = row.last_seen_at;
    row.last_seen_at = laterIso(row.last_seen_at, cloud.last_seen_at);
    row.last_studied_at = laterIso(row.last_studied_at, cloud.last_studied_at);
    row.last_tested_at = laterIso(row.last_tested_at, cloud.last_tested_at);
    if (cloud.last_seen_at && row.last_seen_at !== localSeen) {
      row.last_mode = cloud.last_mode || row.last_mode;
      row.last_result = cloud.last_result || row.last_result;
    }
  });
  writeState(state);
}

export function getWordProgressSnapshotRows() {
  return Array.from(getWordProgressMap().values()).map((row) => ({ ...row }));
}

export function getWordProgress(wordId) {
  const state = readState();
  return normalizeRow(state.rows[normalizeId(wordId)], wordId);
}

export function getWordProgressMap() {
  const state = readState();
  return new Map(Object.entries(state.rows).map(([id, row]) => [id, normalizeRow(row, id)]));
}

export function wordProgressSummary(words = []) {
  const map = getWordProgressMap();
  const ids = (Array.isArray(words) ? words : []).map((word) => normalizeId(word?.id || word)).filter(Boolean);
  let mastered = 0;
  let review = 0;
  ids.forEach((id) => {
    const status = map.get(id)?.mastery_status;
    if (status === "mastered" || status === "review") mastered += 1;
    if (status === "review") review += 1;
  });
  return {
    total: ids.length,
    mastered,
    review,
    percent: ids.length ? Math.round((mastered / ids.length) * 100) : 0,
  };
}

export function problemWordRows(words = [], limit = 7) {
  const map = getWordProgressMap();
  return (Array.isArray(words) ? words : [])
    .map((word) => {
      const progress = map.get(normalizeId(word.id)) || emptyRow(word.id);
      const evaluated = progress.study_shown_count;
      const unknownRate = evaluated ? Math.round((progress.unknown_count / evaluated) * 100) : 0;
      return { word, progress, evaluated, unknownRate };
    })
    .filter((item) => item.progress.unknown_count > 0 || item.progress.test_wrong_count > 0)
    .sort((left, right) => right.unknownRate - left.unknownRate
      || right.progress.unknown_count - left.progress.unknown_count
      || right.progress.test_wrong_count - left.progress.test_wrong_count)
    .slice(0, Math.max(1, Number(limit || 7)));
}

export function testSummariesForWords(words = []) {
  const ids = new Set((Array.isArray(words) ? words : []).map((word) => normalizeId(word?.id || word)).filter(Boolean));
  return getActivityHistory()
    .filter((row) => row.status === "completed" && ["test", "station_test"].includes(row.type))
    .map((row) => {
      const selected = (row.words || []).filter((entry) => ids.has(normalizeId(entry.word_id)));
      if (!selected.length) return null;
      const correct = selected.filter((entry) => entry.result === "correct" || entry.is_correct === true).length;
      const total = selected.length;
      return {
        id: row.id,
        date: row.ended_at || row.started_at,
        correct,
        total,
        percent: total ? Math.round((correct / total) * 100) : 0,
      };
    })
    .filter(Boolean);
}

export function recentTestSummariesForWords(words = [], limit = 3) {
  return testSummariesForWords(words).slice(0, Math.max(1, Number(limit || 3)));
}

export function allWordMasterySummary(words = []) {
  return wordProgressSummary(words);
}

export function awardWordMilestones(words = []) {
  const summary = Array.isArray(words) && words.length
    ? allWordMasterySummary(words)
    : { mastered: Array.from(getWordProgressMap().values()).filter((row) => row.mastery_status === "mastered" || row.mastery_status === "review").length };
  const highest = Math.floor(summary.mastered / 20) * 20;
  for (let value = 20; value <= highest; value += 20) {
    awardReward({ rewardId: `achievement:words:${value}` });
  }
  return highest;
}

import { getActivityHistory } from "./activity-history-store.js";
import { readScopedJson, writeScopedJson } from "./storage-scope.js";
import { awardReward } from "./reward-store.js";
import { enqueueProgress } from "./progress-queue.js";

export const WORD_PROGRESS_LOCAL_KEY = "alantil_word_progress_v13_5";
const MAX_PROCESSED_SESSIONS = 600;

function normalizeId(value) {
  return String(value ?? "").trim();
}

function emptyRow(wordId) {
  return {
    word_id: normalizeId(wordId),
    study_shown_count: 0,
    known_count: 0,
    unknown_count: 0,
    test_correct_count: 0,
    test_wrong_count: 0,
    mastery_status: "not_started",
    mastered_at: null,
    last_result: null,
    last_seen_at: null,
  };
}

function normalizeRow(row = {}, wordId = row.word_id) {
  const normalized = {
    ...emptyRow(wordId),
    ...row,
    word_id: normalizeId(wordId || row.word_id),
  };
  [
    "study_shown_count",
    "known_count",
    "unknown_count",
    "test_correct_count",
    "test_wrong_count",
  ].forEach((key) => {
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

function queueWordProgress(rows = []) {
  const updatedAt = new Date().toISOString();
  rows.forEach((row) => {
    if (!row?.word_id) return;
    enqueueProgress("word_progress", {
      word_id: row.word_id,
      study_shown_count: row.study_shown_count,
      known_count: row.known_count,
      unknown_count: row.unknown_count,
      test_correct_count: row.test_correct_count,
      test_wrong_count: row.test_wrong_count,
      mastery_status: row.mastery_status,
      mastered_at: row.mastered_at,
      last_result: row.last_result,
      last_seen_at: row.last_seen_at,
      updated_at: updatedAt,
    }, { id: `word_progress:${row.word_id}` });
  });
}

export function recordLearnWordResults(sessionId, words = [], completedAt = new Date().toISOString()) {
  const state = readState();
  if (!markProcessed(state, sessionId)) return false;
  const changed = [];
  (Array.isArray(words) ? words : []).forEach((entry) => {
    const row = withMutableRow(state, entry?.word_id);
    if (!row) return;
    row.study_shown_count += Math.max(0, Number(entry.show_count || 0));
    row.unknown_count += Math.max(0, Number(entry.left_swipe_count || 0));
    if (entry.final_result === "known") row.known_count += 1;
    if (row.mastery_status === "not_started") row.mastery_status = "learning";
    row.last_result = entry.final_result === "known" ? "known" : "unknown";
    row.last_seen_at = completedAt;
    changed.push(row);
  });
  writeState(state);
  queueWordProgress(changed);
  return true;
}

export function recordTestWordResults({
  sessionId,
  answers = [],
  accuracy = 0,
  requiredAccuracy = 80,
  completedAt = new Date().toISOString(),
} = {}) {
  const state = readState();
  if (!markProcessed(state, sessionId)) return false;
  const passed = Number(accuracy || 0) >= Number(requiredAccuracy || 80);
  const changed = [];
  (Array.isArray(answers) ? answers : []).forEach((entry) => {
    const row = withMutableRow(state, entry?.word_id || entry?.wordId);
    if (!row) return;
    const correct = entry.result === "correct" || entry.isCorrect === true;
    if (correct) row.test_correct_count += 1;
    else row.test_wrong_count += 1;
    if (passed && correct) {
      row.mastery_status = "mastered";
      row.mastered_at ||= completedAt;
    } else if (!correct && row.mastered_at) {
      row.mastery_status = "review";
    } else if (row.mastery_status === "not_started") {
      row.mastery_status = "learning";
    }
    row.last_result = correct ? "correct" : "wrong";
    row.last_seen_at = completedAt;
    changed.push(row);
  });
  writeState(state);
  queueWordProgress(changed);
  if (passed) awardWordMilestones();
  return true;
}

export function mergeCloudWordProgress(rows = []) {
  const state = readState();
  (Array.isArray(rows) ? rows : []).forEach((cloud) => {
    const row = withMutableRow(state, cloud?.word_id);
    if (!row) return;
    row.study_shown_count = Math.max(row.study_shown_count, Number(cloud.study_shown_count ?? cloud.learn_shows_total ?? 0));
    row.known_count = Math.max(row.known_count, Number(cloud.known_count ?? cloud.learn_known_total ?? 0));
    row.unknown_count = Math.max(row.unknown_count, Number(cloud.unknown_count ?? cloud.learn_left_swipes_total ?? 0));
    row.test_correct_count = Math.max(row.test_correct_count, Number(cloud.test_correct_count ?? cloud.test_correct_total ?? 0));
    row.test_wrong_count = Math.max(row.test_wrong_count, Number(cloud.test_wrong_count ?? cloud.test_wrong_total ?? 0));
    const explicitStatus = String(cloud.mastery_status || "").trim();
    if (["mastered", "review", "learning"].includes(explicitStatus)) row.mastery_status = explicitStatus;
    if (cloud.mastered_at) {
      row.mastered_at = row.mastered_at || cloud.mastered_at;
      if (row.mastery_status === "not_started") row.mastery_status = "mastered";
    }
    if (cloud.last_result) row.last_result = cloud.last_result;
    if (cloud.last_seen_at) row.last_seen_at = cloud.last_seen_at;
  });
  writeState(state);
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

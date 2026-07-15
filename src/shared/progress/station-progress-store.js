import { PATH_CONFIG } from "../../config/path.js";
import { stationKey } from "../domain/learning-route.js";
import { enqueueProgress } from "./progress-queue.js";
import { readScopedJson, writeScopedJson } from "./storage-scope.js";

export const STATION_PROGRESS_KEY = "alantil_station_progress_v13_1";
const DAY_MS = 24 * 60 * 60 * 1000;
const listeners = new Set();

function nowIso() {
  return new Date().toISOString();
}

function asTime(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function effectiveStatus(row, now = Date.now()) {
  const status = String(row?.status || "");
  if (status === "review_1_waiting" && asTime(row.review_1_due_at) <= now) return "review_1_due";
  if (status === "review_2_waiting" && asTime(row.review_2_due_at) <= now) return "review_2_due";
  return status || "available";
}

function normalizeRow(row = {}) {
  const normalized = {
    dictionary_id: String(row.dictionary_id || PATH_CONFIG.dictionaryId),
    catalog_id: String(row.catalog_id || "").trim(),
    group_id: String(row.group_id || "").trim(),
    set_id: String(row.set_id || "").trim(),
    story_type: String(row.story_type || "").trim(),
    status: String(row.status || "available"),
    current_phase: String(row.current_phase || "study"),
    study_sessions_total: Math.max(0, Number(row.study_sessions_total || 0)),
    test_attempts_total: Math.max(0, Number(row.test_attempts_total || 0)),
    best_accuracy: Math.max(0, Math.min(100, Number(row.best_accuracy || 0))),
    first_test_completed_at: row.first_test_completed_at || null,
    review_1_due_at: row.review_1_due_at || null,
    review_1_completed_at: row.review_1_completed_at || null,
    review_2_due_at: row.review_2_due_at || null,
    review_2_completed_at: row.review_2_completed_at || null,
    mastered_at: row.mastered_at || null,
    updated_at: row.updated_at || nowIso(),
  };
  normalized.status = effectiveStatus(normalized);
  return normalized;
}

function mapKey(row) {
  return [row.dictionary_id, row.catalog_id, row.group_id, row.set_id].join("::");
}

function readMap() {
  const raw = readScopedJson(STATION_PROGRESS_KEY, {});
  const output = {};
  Object.entries(raw && typeof raw === "object" ? raw : {}).forEach(([key, value]) => {
    output[key] = normalizeRow(value);
  });
  return output;
}

function writeMap(map) {
  writeScopedJson(STATION_PROGRESS_KEY, map);
  listeners.forEach((listener) => {
    try { listener(map); } catch (error) { console.error("Station progress subscriber failed", error); }
  });
  return map;
}

function payloadForStation(station, updates = {}) {
  return normalizeRow({
    dictionary_id: station.dictionaryId || PATH_CONFIG.dictionaryId,
    catalog_id: station.catalogId,
    group_id: station.groupId,
    set_id: station.setId,
    story_type: station.storyType,
    ...updates,
  });
}

function save(station, row, { queue = true } = {}) {
  const map = readMap();
  const normalized = normalizeRow(row);
  map[stationKey(station)] = normalized;
  writeMap(map);
  if (queue) {
    enqueueProgress("station_progress", normalized, {
      id: `station_progress:${mapKey(normalized)}`,
      replace: true,
    });
  }
  return normalized;
}

export function getStationProgress(station) {
  if (!station) return null;
  const row = readMap()[stationKey(station)];
  return row ? normalizeRow(row) : null;
}

export function getAllStationProgress() {
  return Object.values(readMap()).map(normalizeRow);
}

export function replaceStationProgress(rows = [], { notify = true } = {}) {
  const map = {};
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const normalized = normalizeRow(row);
    if (!normalized.catalog_id || !normalized.group_id || !normalized.set_id) return;
    map[mapKey(normalized)] = normalized;
  });
  if (notify) writeMap(map);
  else writeScopedJson(STATION_PROGRESS_KEY, map);
  return map;
}

export function markStationStarted(station) {
  const current = getStationProgress(station) || payloadForStation(station);
  if (["mastered", "review_1_waiting", "review_1_due", "review_2_waiting", "review_2_due", "test_ready"].includes(current.status)) return current;
  return save(station, {
    ...current,
    status: "studying",
    current_phase: "study",
    study_sessions_total: current.study_sessions_total + 1,
    updated_at: nowIso(),
  });
}

export function markStationCardsCompleted(station) {
  const current = getStationProgress(station) || payloadForStation(station);
  if (current.status === "mastered") return current;
  return save(station, {
    ...current,
    status: "test_ready",
    current_phase: "first_test",
    updated_at: nowIso(),
  });
}

export function stationTestPhase(station) {
  const current = getStationProgress(station);
  const status = effectiveStatus(current || { status: "test_ready" });
  if (status === "review_1_due") return "review_1";
  if (status === "review_2_due") return "review_2";
  if (status === "mastered") return "practice";
  return "first_test";
}

export function recordStationTest(station, { accuracy, passed, phase = stationTestPhase(station), completedAt = nowIso() }) {
  const current = getStationProgress(station) || payloadForStation(station, { status: "test_ready" });
  const next = {
    ...current,
    test_attempts_total: current.test_attempts_total + 1,
    best_accuracy: Math.max(current.best_accuracy, Number(accuracy || 0)),
    updated_at: completedAt,
  };

  if (!passed || phase === "practice") return save(station, next);
  if (phase === "first_test") {
    next.status = "review_1_waiting";
    next.current_phase = "review_1";
    next.first_test_completed_at = completedAt;
    next.review_1_due_at = new Date(Date.parse(completedAt) + PATH_CONFIG.review1DelayDays * DAY_MS).toISOString();
  } else if (phase === "review_1") {
    next.status = "review_2_waiting";
    next.current_phase = "review_2";
    next.review_1_completed_at = completedAt;
    next.review_2_due_at = new Date(Date.parse(completedAt) + PATH_CONFIG.review2DelayDays * DAY_MS).toISOString();
  } else if (phase === "review_2") {
    next.status = "mastered";
    next.current_phase = "mastered";
    next.review_2_completed_at = completedAt;
    next.mastered_at = completedAt;
  }
  return save(station, next);
}

export function mergeStationProgressRows(rows = []) {
  const map = readMap();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const normalized = normalizeRow(row);
    const key = mapKey(normalized);
    const existing = map[key];
    if (!existing || asTime(normalized.updated_at) >= asTime(existing.updated_at)) map[key] = normalized;
  });
  return writeMap(map);
}

export function subscribeStationProgress(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function formatDueDate(value) {
  const time = asTime(value);
  if (!time) return "";
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(time));
}

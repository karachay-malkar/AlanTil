import { stationKey } from "../domain/learning-route.js?v=13.13";
import { getInterfaceLocale } from "../i18n/index.js?v=13.9.0";
import { enqueueProgress } from "./progress-queue.js?v=13.9.0";
import { readScopedJson, writeScopedJson } from "./storage-scope.js?v=13.9.0";
import {
  createStationProgressRow,
  effectiveStationStatus,
  mergeStationProgress,
  normalizeStationProgressRow,
  recordStationTestProgress,
  stationProgressMapKey,
  stationProgressTime,
  stationTestPhaseFromProgress,
  transitionStationCardsCompleted,
  transitionStationStarted,
} from "../../../packages/alantil-core/progress.js";

export const STATION_PROGRESS_KEY = "alantil_station_progress_v13_2";
const listeners = new Set();

function readMap() {
  const raw = readScopedJson(STATION_PROGRESS_KEY, {});
  const output = {};
  Object.values(raw && typeof raw === "object" ? raw : {}).forEach((value) => {
    const normalized = normalizeStationProgressRow(value);
    if (!normalized.story_type || !normalized.dictionary_id || !normalized.group_id || !normalized.set_id) return;
    output[stationProgressMapKey(normalized)] = normalized;
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
  return createStationProgressRow(station, updates);
}

function save(station, row, { queue = true } = {}) {
  const map = readMap();
  const normalized = normalizeStationProgressRow(row, station);
  map[stationKey(station)] = normalized;
  writeMap(map);
  if (queue) {
    enqueueProgress("station_progress", normalized, {
      id: `station_progress:${stationProgressMapKey(normalized)}`,
      replace: true,
    });
  }
  return normalized;
}

export function getStationProgress(station) {
  if (!station) return null;
  const row = readMap()[stationKey(station)];
  return row ? normalizeStationProgressRow(row, station) : null;
}

export function getAllStationProgress() {
  return Object.values(readMap()).map((row) => normalizeStationProgressRow(row));
}

export function replaceStationProgress(rows = [], { notify = true } = {}) {
  const map = {};
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const normalized = normalizeStationProgressRow(row);
    if (!normalized.story_type || !normalized.dictionary_id || !normalized.group_id || !normalized.set_id) return;
    map[stationProgressMapKey(normalized)] = normalized;
  });
  if (notify) writeMap(map);
  else writeScopedJson(STATION_PROGRESS_KEY, map);
  return map;
}

export function markStationStarted(station) {
  const current = getStationProgress(station) || payloadForStation(station);
  const transition = transitionStationStarted(current);
  return transition.changed ? save(station, transition.row) : current;
}

export function markStationCardsCompleted(station) {
  const current = getStationProgress(station) || payloadForStation(station);
  const transition = transitionStationCardsCompleted(current);
  return transition.changed ? save(station, transition.row) : current;
}

export function stationTestPhase(station) {
  return stationTestPhaseFromProgress(getStationProgress(station));
}

export function recordStationTest(station, { accuracy, passed, phase = stationTestPhase(station), completedAt = new Date().toISOString() }) {
  const current = getStationProgress(station) || payloadForStation(station, { status: "test_ready" });
  return save(station, recordStationTestProgress(current, { accuracy, passed, phase, completedAt }));
}

export function mergeStationProgressRows(rows = []) {
  const merged = mergeStationProgress(Object.values(readMap()), rows);
  const map = {};
  merged.forEach((row) => { map[stationProgressMapKey(row)] = row; });
  return writeMap(map);
}

export function subscribeStationProgress(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function formatDueDate(value) {
  const time = stationProgressTime(value);
  if (!time) return "";
  return new Intl.DateTimeFormat(getInterfaceLocale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(time));
}

export function canonicalStationStatus(row) {
  return effectiveStationStatus(row);
}

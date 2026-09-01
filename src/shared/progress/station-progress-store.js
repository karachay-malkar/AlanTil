import { PATH_CONFIG } from "../../config/path.js?v=13.13";
import { stationKey } from "../domain/learning-route.js?v=13.13";
import { permanentSectionId, storyIdForDictionary } from "../domain/word-normalizer.js?v=13.13";
import { getInterfaceLocale } from "../i18n/index.js?v=13.9.0";
import { enqueueProgress } from "./progress-queue.js?v=13.9.0";
import { readScopedJson, writeScopedJson } from "./storage-scope.js?v=13.9.0";
import {
  effectiveStationStatus,
  markStationCardsCompletedProgress,
  markStationStartedProgress,
  normalizeStationLifecycle,
  progressTime,
  recordStationTestProgress,
  stationTestPhaseFromProgress,
} from "../../../packages/alantil-core/progress.js";

export const STATION_PROGRESS_KEY = "alantil_station_progress_v13_2";
const listeners = new Set();

function nowIso() {
  return new Date().toISOString();
}

function normalizeRow(row = {}) {
  const dictionaryId = String(row.dictionary_id || row.catalog_id || PATH_CONFIG.dictionaryId).trim();
  const setId = String(row.set_id || "").trim();
  const persistedSection = String(row.section_id || row.group_id || "").trim();
  const sectionId = persistedSection && persistedSection !== dictionaryId
    ? persistedSection
    : permanentSectionId(dictionaryId, setId);
  const storyType = String(row.story_type || storyIdForDictionary(dictionaryId) || "").trim();
  return normalizeStationLifecycle({
    ...row,
    dictionary_id: dictionaryId,
    catalog_id: dictionaryId,
    group_id: sectionId,
    set_id: setId,
    story_type: storyType,
    updated_at: row.updated_at || nowIso(),
  });
}

function mapKey(row) {
  return [row.story_type, row.dictionary_id, row.group_id, row.set_id].join("::");
}

function readMap() {
  const raw = readScopedJson(STATION_PROGRESS_KEY, {});
  const output = {};
  Object.values(raw && typeof raw === "object" ? raw : {}).forEach((value) => {
    const normalized = normalizeRow(value);
    if (!normalized.story_type || !normalized.dictionary_id || !normalized.group_id || !normalized.set_id) return;
    output[mapKey(normalized)] = normalized;
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
    dictionary_id: station.dictionaryId,
    group_id: station.sectionId || station.groupId,
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
    if (!normalized.story_type || !normalized.dictionary_id || !normalized.group_id || !normalized.set_id) return;
    map[mapKey(normalized)] = normalized;
  });
  if (notify) writeMap(map);
  else writeScopedJson(STATION_PROGRESS_KEY, map);
  return map;
}

export function markStationStarted(station) {
  const current = getStationProgress(station) || payloadForStation(station);
  return save(station, markStationStartedProgress(current));
}

export function markStationCardsCompleted(station) {
  const current = getStationProgress(station) || payloadForStation(station);
  return save(station, markStationCardsCompletedProgress(current));
}

export function stationTestPhase(station) {
  const current = getStationProgress(station);
  return stationTestPhaseFromProgress(current || { status: "test_ready" });
}

export function recordStationTest(station, { accuracy, passed, phase = stationTestPhase(station), completedAt = nowIso() }) {
  const current = getStationProgress(station) || payloadForStation(station, { status: "test_ready" });
  const next = recordStationTestProgress(current, {
    accuracy,
    passed,
    phase,
    completedAt,
    review1DelayDays: PATH_CONFIG.review1DelayDays,
    review2DelayDays: PATH_CONFIG.review2DelayDays,
  });
  return save(station, next);
}

export function mergeStationProgressRows(rows = []) {
  const map = readMap();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const normalized = normalizeRow(row);
    if (!normalized.story_type || !normalized.dictionary_id || !normalized.group_id || !normalized.set_id) return;
    const key = mapKey(normalized);
    const existing = map[key];
    if (!existing || progressTime(normalized.updated_at) >= progressTime(existing.updated_at)) map[key] = normalized;
  });
  return writeMap(map);
}

export function subscribeStationProgress(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function formatDueDate(value) {
  const time = progressTime(value);
  if (!time) return "";
  return new Intl.DateTimeFormat(getInterfaceLocale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(time));
}

export { effectiveStationStatus };

import { getCurrentAuthState, subscribeToAuth } from "../auth/auth-service.js?v=13.8";
import { normalizeId } from "../domain/word-normalizer.js?v=13.8";
import { getUserSettings, replaceUserSettings } from "../settings/user-settings-store.js?v=13.8";
import {
  enqueueProgress,
  mergeProgressQueues,
  readProgressQueue,
  removeProgressEntry,
  updateProgressEntry,
  writeProgressQueue,
} from "./progress-queue.js?v=13.8";
import { executeProgressEntry, fetchCloudProgressState } from "./progress-repository.js?v=13.8";
import { nextUnattemptedProgressEntry, shouldDiscardProgressError } from "./progress-sync-policy.js?v=13.8";
import { mergeStationProgressRows, replaceStationProgress } from "./station-progress-store.js?v=13.8";
import { replaceUserRewards } from "./reward-store.js?v=13.8";
import { replaceRouteSettings } from "./route-settings-store.js?v=13.8";
import { mergeCloudWordProgress, WORD_PROGRESS_LOCAL_KEY } from "./word-progress-store.js?v=13.8";
import { snapshotRecoveredSession } from "./session-builders.js?v=13.8";
import { readActiveSessions, removeActiveSession } from "./session-store.js?v=13.8";
import {
  getStorageScope,
  getStorageScopeUserId,
  migrateLegacyValueToGuest,
  readScopedJson,
  removeScopedValue,
  setStorageScope,
  STORAGE_SCOPES,
  storageScopeForUser,
  writeScopedJson,
} from "./storage-scope.js?v=13.8";

const WORD_FAVORITES_KEY = "fc_favorites_v1";
const SONG_FAVORITES_KEY = "alantil_song_favorites_v1";
const HIDDEN_KEY = "fc_hidden_by_set_v7";
const FINISHED_KEY = "fc_finished_sets_v1";
const USER_SETTINGS_KEY = "alantil_user_settings_v1";
const CLAIM_MARKER_KEY = "alantil_guest_claim_v1";
const LEGACY_KEYS = [WORD_FAVORITES_KEY, SONG_FAVORITES_KEY, HIDDEN_KEY, FINISHED_KEY, USER_SETTINGS_KEY, WORD_PROGRESS_LOCAL_KEY];
const SNAPSHOT_STATUS_RANK = Object.freeze({ not_started: 0, learning: 1, mastered: 2, review: 3 });

let initialized = false;
let unsubscribeAuth = null;
let syncPromise = null;
let pullPromise = null;
let bound = false;
let lastUserId = "";

function setKey(dictionaryId, sectionId, setId) {
  return `${String(dictionaryId || "")}:${String(sectionId || "")}:${String(setId || "")}`;
}

function parseSetKey(value) {
  const text = String(value || "");
  const first = text.indexOf(":");
  const second = first < 0 ? -1 : text.indexOf(":", first + 1);
  if (first < 0 || second < 0) return [text, "", ""];
  return [text.slice(0, first), text.slice(first + 1, second), text.slice(second + 1)];
}

function safeReadGlobal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function safeWriteGlobal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function migrateLegacyStorage() {
  LEGACY_KEYS.forEach((key) => migrateLegacyValueToGuest(key));
}

function snapshotWordRow(row = {}) {
  const wordId = normalizeId(row.word_id);
  if (!wordId) return null;
  return {
    word_id: wordId,
    sessions_total: Math.max(0, Number(row.sessions_total || 0)),
    learn_sessions_total: Math.max(0, Number(row.learn_sessions_total || 0)),
    learn_unfinished_total: Math.max(0, Number(row.learn_unfinished_total || 0)),
    test_answers_total: Math.max(0, Number(row.test_answers_total || 0)),
    match_sessions_total: Math.max(0, Number(row.match_sessions_total || 0)),
    match_success_total: Math.max(0, Number(row.match_success_total || 0)),
    match_errors_total: Math.max(0, Number(row.match_errors_total || 0)),
    study_shown_count: Math.max(0, Number(row.study_shown_count || 0)),
    known_count: Math.max(0, Number(row.known_count || 0)),
    unknown_count: Math.max(0, Number(row.unknown_count || 0)),
    test_correct_count: Math.max(0, Number(row.test_correct_count || 0)),
    test_wrong_count: Math.max(0, Number(row.test_wrong_count || 0)),
    mastery_status: ["not_started", "learning", "mastered", "review"].includes(row.mastery_status)
      ? row.mastery_status
      : "not_started",
    mastered_at: row.mastered_at || null,
    last_mode: row.last_mode || null,
    last_result: row.last_result || null,
    last_seen_at: row.last_seen_at || null,
    last_studied_at: row.last_studied_at || null,
    last_tested_at: row.last_tested_at || null,
  };
}

function mergeSnapshotRows(rows = []) {
  const numericFields = [
    "sessions_total", "learn_sessions_total", "learn_unfinished_total", "test_answers_total",
    "match_sessions_total", "match_success_total", "match_errors_total", "study_shown_count",
    "known_count", "unknown_count", "test_correct_count", "test_wrong_count",
  ];
  const byId = new Map();
  rows.forEach((value) => {
    const row = snapshotWordRow(value);
    if (!row) return;
    const current = byId.get(row.word_id);
    if (!current) {
      byId.set(row.word_id, row);
      return;
    }
    numericFields.forEach((field) => { current[field] = Math.max(current[field], row[field]); });
    if (SNAPSHOT_STATUS_RANK[row.mastery_status] > SNAPSHOT_STATUS_RANK[current.mastery_status]) {
      current.mastery_status = row.mastery_status;
    }
    if (row.mastered_at && (!current.mastered_at || Date.parse(row.mastered_at) < Date.parse(current.mastered_at))) {
      current.mastered_at = row.mastered_at;
    }
    if (Date.parse(row.last_studied_at || "") > Date.parse(current.last_studied_at || "")) {
      current.last_studied_at = row.last_studied_at;
    }
    if (Date.parse(row.last_tested_at || "") > Date.parse(current.last_tested_at || "")) {
      current.last_tested_at = row.last_tested_at;
    }
    if (Date.parse(row.last_seen_at || "") > Date.parse(current.last_seen_at || "")) {
      current.last_seen_at = row.last_seen_at;
      current.last_mode = row.last_mode;
      current.last_result = row.last_result;
    }
  });
  return Array.from(byId.values());
}

function migrateLegacyWordProgressQueue(scope) {
  const queue = readProgressQueue(scope);
  const legacy = queue.filter((entry) => entry.type === "word_progress");
  if (!legacy.length) return queue;
  const words = mergeSnapshotRows(legacy.map((entry) => entry.payload));
  const createdAt = legacy.map((entry) => entry.created_at).filter(Boolean).sort()[0] || new Date().toISOString();
  const snapshotId = `legacy:${scope}`;
  const next = queue.filter((entry) => entry.type !== "word_progress");
  if (words.length) {
    next.push({
      id: `word_progress_snapshot:${snapshotId}`,
      type: "word_progress_snapshot",
      payload: { snapshot_id: snapshotId, words },
      claim_id: "",
      created_at: createdAt,
      attempts: 0,
    });
  }
  writeProgressQueue(next, scope);
  return next;
}

function recoverInterruptedSessions(scope = getStorageScope()) {
  const sessions = readActiveSessions(scope);
  Object.entries(sessions).forEach(([type, snapshot]) => {
    if (!snapshot?.id || !["learn", "test", "match"].includes(type)) return;
    const payload = snapshotRecoveredSession(snapshot, "close");
    enqueueProgress(`${type}_session`, payload, {
      scope,
      id: `${type}_session:${payload.id}`,
      replace: false,
    });
    removeActiveSession(type, scope);
  });
}

async function applyFavoriteState(wordIds, songIds) {
  const [{ wordFavorites }, { songFavorites }] = await Promise.all([
    import("../state/word-favorites.js?v=13.8"),
    import("../state/song-favorites.js?v=13.8"),
  ]);
  wordFavorites.replace(wordIds, { notifyListeners: true });
  songFavorites.replace(songIds, { notifyListeners: true });
}

function applyHiddenRows(rows) {
  const map = {};
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (!row?.is_hidden) return;
    const key = setKey(row.dictionary_id, row.section_id, row.set_id);
    if (!map[key]) map[key] = [];
    const wordId = normalizeId(row.word_id);
    if (wordId && !map[key].includes(wordId)) map[key].push(wordId);
  });
  writeScopedJson(HIDDEN_KEY, map);
}

function applySetProgressRows(rows) {
  const map = {};
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (!row?.is_finished) return;
    map[setKey(row.dictionary_id, row.section_id, row.set_id)] = true;
  });
  writeScopedJson(FINISHED_KEY, map);
}

async function applyCloudState(state) {
  await applyFavoriteState(
    state.wordFavorites.filter((row) => row.is_active).map((row) => row.word_id),
    state.songFavorites.filter((row) => row.is_active).map((row) => row.song_id),
  );
  applyHiddenRows(state.hiddenWords);
  applySetProgressRows(state.setProgress);
  replaceStationProgress(state.stationProgress || []);
  replaceUserRewards(state.rewards || []);
  mergeCloudWordProgress(state.wordProgress || []);
  if (state.routeSettings) replaceRouteSettings(state.routeSettings);
  if (state.userSettings) {
    replaceUserSettings(state.userSettings);
  } else {
    enqueueProgress("user_settings", {
      ...getUserSettings(),
      updated_at: new Date().toISOString(),
    }, { id: "user_settings:current" });
  }
}

async function applyQueueEntryLocally(entry) {
  const payload = entry?.payload || {};
  if (entry.type === "word_favorite") {
    const { wordFavorites } = await import("../state/word-favorites.js?v=13.8");
    wordFavorites.setActive(payload.word_id, payload.is_active, { queue: false });
  } else if (entry.type === "song_favorite") {
    const { songFavorites } = await import("../state/song-favorites.js?v=13.8");
    songFavorites.setActive(payload.song_id, payload.is_active, { queue: false });
  } else if (entry.type === "hidden_word") {
    const map = readScopedJson(HIDDEN_KEY, {});
    const key = setKey(payload.dictionary_id, payload.section_id, payload.set_id);
    const ids = new Set(Array.isArray(map[key]) ? map[key] : []);
    if (payload.is_hidden) ids.add(normalizeId(payload.word_id));
    else ids.delete(normalizeId(payload.word_id));
    map[key] = Array.from(ids).filter(Boolean);
    writeScopedJson(HIDDEN_KEY, map);
  } else if (entry.type === "set_progress") {
    const map = readScopedJson(FINISHED_KEY, {});
    const key = setKey(payload.dictionary_id, payload.section_id, payload.set_id);
    if (payload.is_finished) map[key] = true;
    else delete map[key];
    writeScopedJson(FINISHED_KEY, map);
  } else if (entry.type === "station_progress") {
    mergeStationProgressRows([payload]);
  } else if (entry.type === "user_reward") {
    const { getUserRewards, replaceUserRewards } = await import("./reward-store.js?v=13.8");
    replaceUserRewards([...getUserRewards(), payload]);
  } else if (entry.type === "route_settings") {
    replaceRouteSettings(payload);
  } else if (entry.type === "user_settings") {
    replaceUserSettings(payload);
  } else if (entry.type === "word_progress_snapshot") {
    mergeCloudWordProgress(payload.words || []);
  }
}

async function reapplyPendingLocalChanges(scope = getStorageScope()) {
  const queue = readProgressQueue(scope);
  for (const entry of queue) await applyQueueEntryLocally(entry);
}

function readClaimMarker() {
  const marker = safeReadGlobal(CLAIM_MARKER_KEY, null);
  return marker && typeof marker === "object" ? marker : null;
}

function guestStateEntries(now = new Date().toISOString(), snapshotId = `guest:${Date.now()}`) {
  const entries = [];
  const wordFavorites = readScopedJson(WORD_FAVORITES_KEY, [], STORAGE_SCOPES.GUEST);
  const songFavorites = readScopedJson(SONG_FAVORITES_KEY, [], STORAGE_SCOPES.GUEST);
  const hidden = readScopedJson(HIDDEN_KEY, {}, STORAGE_SCOPES.GUEST);
  const finished = readScopedJson(FINISHED_KEY, {}, STORAGE_SCOPES.GUEST);
  const settings = readScopedJson(USER_SETTINGS_KEY, null, STORAGE_SCOPES.GUEST);
  const wordProgress = readScopedJson(WORD_PROGRESS_LOCAL_KEY, { rows: {} }, STORAGE_SCOPES.GUEST);

  (Array.isArray(wordFavorites) ? wordFavorites : []).forEach((wordId) => entries.push({
    type: "word_favorite",
    payload: { word_id: normalizeId(wordId), is_active: true, updated_at: now },
    id: `word_favorite:${normalizeId(wordId)}`,
  }));
  (Array.isArray(songFavorites) ? songFavorites : []).forEach((songId) => entries.push({
    type: "song_favorite",
    payload: { song_id: String(songId || "").trim(), is_active: true, updated_at: now },
    id: `song_favorite:${String(songId || "").trim()}`,
  }));
  Object.entries(hidden || {}).forEach(([key, values]) => {
    const [dictionary_id, section_id, set_id] = parseSetKey(key);
    (Array.isArray(values) ? values : []).forEach((wordId) => entries.push({
      type: "hidden_word",
      payload: { dictionary_id, section_id, set_id, word_id: normalizeId(wordId), is_hidden: true, updated_at: now },
      id: `hidden_word:${dictionary_id}:${section_id}:${set_id}:${normalizeId(wordId)}`,
    }));
  });
  Object.entries(finished || {}).forEach(([key, active]) => {
    if (!active) return;
    const [dictionary_id, section_id, set_id] = parseSetKey(key);
    entries.push({
      type: "set_progress",
      payload: { dictionary_id, section_id, set_id, is_finished: true, updated_at: now },
      id: `set_progress:${dictionary_id}:${section_id}:${set_id}`,
    });
  });
  const snapshotWords = mergeSnapshotRows(Object.values(wordProgress?.rows || {}));
  if (snapshotWords.length) entries.push({
    type: "word_progress_snapshot",
    payload: { snapshot_id: snapshotId, words: snapshotWords },
    id: `word_progress_snapshot:${snapshotId}`,
  });
  if (settings) entries.push({
    type: "user_settings",
    payload: { ...settings, updated_at: now },
    id: "user_settings:current",
  });
  return entries.filter((entry) => {
    if (!entry.payload) return false;
    if (entry.type === "word_favorite") return Boolean(entry.payload.word_id);
    if (entry.type === "song_favorite") return Boolean(entry.payload.song_id);
    if (entry.type === "hidden_word") return Boolean(entry.payload.dictionary_id && entry.payload.set_id && entry.payload.word_id);
    if (entry.type === "set_progress") return Boolean(entry.payload.dictionary_id && entry.payload.set_id);
    if (entry.type === "word_progress_snapshot") return Boolean(entry.payload.snapshot_id && entry.payload.words?.length);
    return entry.type === "user_settings";
  });
}

async function claimGuestData(userId) {
  const marker = readClaimMarker();
  if (marker?.status === "pending" && marker.user_id !== userId) return marker;
  const userScope = storageScopeForUser(userId);
  const claimId = marker?.status === "pending" && marker.user_id === userId
    ? marker.claim_id
    : `claim:${userId}:${Date.now()}`;
  migrateLegacyWordProgressQueue(STORAGE_SCOPES.GUEST);
  const guestQueue = readProgressQueue(STORAGE_SCOPES.GUEST);
  const stateEntries = guestStateEntries(new Date().toISOString(), claimId);
  if (!guestQueue.length && !stateEntries.length) return marker;
  const prepared = [...guestQueue, ...stateEntries].map((entry) => ({
    ...entry,
    claim_id: claimId,
    created_at: entry.created_at || new Date().toISOString(),
    attempts: entry.attempts || 0,
  }));
  mergeProgressQueues(prepared, userScope, { claimId });
  safeWriteGlobal(CLAIM_MARKER_KEY, {
    user_id: userId,
    claim_id: claimId,
    status: "pending",
    entry_ids: prepared.map((entry) => entry.id),
  });
  for (const entry of prepared) await applyQueueEntryLocally(entry);
  return readClaimMarker();
}

function finalizeGuestClaimIfReady(scope) {
  const marker = readClaimMarker();
  if (!marker || marker.status !== "pending" || storageScopeForUser(marker.user_id) !== scope) return;
  const queueIds = new Set(readProgressQueue(scope).map((entry) => entry.id));
  if ((marker.entry_ids || []).some((id) => queueIds.has(id))) return;
  [WORD_FAVORITES_KEY, SONG_FAVORITES_KEY, HIDDEN_KEY, FINISHED_KEY, USER_SETTINGS_KEY, WORD_PROGRESS_LOCAL_KEY].forEach((key) => removeScopedValue(key, STORAGE_SCOPES.GUEST));
  writeProgressQueue([], STORAGE_SCOPES.GUEST);
  safeWriteGlobal(CLAIM_MARKER_KEY, { ...marker, status: "completed", completed_at: new Date().toISOString() });
}

export async function flushProgressQueue() {
  const scope = getStorageScope();
  const userId = getStorageScopeUserId(scope);
  if (!userId || getCurrentAuthState().user?.id !== userId) return false;
  if (pullPromise) await pullPromise;
  if (getStorageScope() !== scope || getCurrentAuthState().user?.id !== userId) return false;
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    const attemptedIds = new Set();
    let completedWithoutErrors = true;
    let queue = readProgressQueue(scope);
    while (getStorageScope() === scope && getCurrentAuthState().user?.id === userId) {
      const entry = nextUnattemptedProgressEntry(queue, attemptedIds);
      if (!entry) break;
      attemptedIds.add(entry.id);
      try {
        await executeProgressEntry(entry);
        removeProgressEntry(entry.id, scope);
      } catch (error) {
        if (shouldDiscardProgressError(entry, error)) {
          // A favorite from a removed legacy dictionary cannot satisfy the
          // canonical content_words foreign key and must not block new data.
          removeProgressEntry(entry.id, scope);
          console.warn("Obsolete word favorite was discarded", entry.payload?.word_id);
        } else {
          completedWithoutErrors = false;
          updateProgressEntry(entry.id, {
            attempts: Number(entry.attempts || 0) + 1,
            last_error_at: new Date().toISOString(),
          }, scope);
          console.warn("Progress entry synchronization failed", entry.type, error);
        }
      }
      queue = readProgressQueue(scope);
    }
    finalizeGuestClaimIfReady(scope);
    return completedWithoutErrors;
  })().finally(() => {
    syncPromise = null;
  });

  return syncPromise;
}

export async function pullCloudProgress() {
  const scope = getStorageScope();
  const userId = getStorageScopeUserId(scope);
  if (!userId || getCurrentAuthState().user?.id !== userId) return false;
  if (syncPromise) await syncPromise;
  if (getStorageScope() !== scope || getCurrentAuthState().user?.id !== userId) return false;
  if (pullPromise) return pullPromise;

  pullPromise = (async () => {
    try {
      const state = await fetchCloudProgressState();
      if (getStorageScope() !== scope) return false;
      await applyCloudState(state);
      await reapplyPendingLocalChanges(scope);
      return true;
    } catch (error) {
      console.warn("Cloud progress could not be loaded", error);
      return false;
    }
  })().finally(() => {
    pullPromise = null;
  });

  return pullPromise;
}

async function activateScopeForUser(userId) {
  setStorageScope(userId);
  migrateLegacyWordProgressQueue(getStorageScope());
  recoverInterruptedSessions();
  if (!userId) return true;
  await pullCloudProgress();
  await claimGuestData(userId);
  await flushProgressQueue();
  return true;
}

function bindSynchronizationEvents() {
  if (bound) return;
  bound = true;
  window.addEventListener("online", () => void flushProgressQueue());
  window.addEventListener("alantil:progress-queued", () => void flushProgressQueue());
}

export async function initializeProgressSystem() {
  if (initialized) return true;
  initialized = true;
  migrateLegacyStorage();
  bindSynchronizationEvents();
  lastUserId = getCurrentAuthState().user?.id || "";
  await activateScopeForUser(lastUserId);
  unsubscribeAuth = subscribeToAuth((state) => {
    const nextUserId = state.user?.id || "";
    if (nextUserId === lastUserId) return;
    lastUserId = nextUserId;
    void activateScopeForUser(nextUserId);
  });
  return true;
}

export function disposeProgressSystem() {
  unsubscribeAuth?.();
  unsubscribeAuth = null;
  initialized = false;
  lastUserId = "";
}

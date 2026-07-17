import { getTranslationLanguageCode } from "../settings/user-settings-store.js?v=13.8.1";
import { createActivityClock } from "./activity-clock.js?v=13.8.1";
import { enqueueProgress } from "./progress-queue.js?v=13.8.1";
import { createSessionId, removeActiveSession, saveActiveSession } from "./session-store.js?v=13.8.1";
import { getStorageScope } from "./storage-scope.js?v=13.8.1";
import { recordActivitySession } from "./activity-history-store.js?v=13.8.1";

const SESSION_QUEUE_TYPES = Object.freeze({
  learn: "learn_session",
  test: "test_session",
  match: "match_session",
});

const activeRuntimes = new Set();
let lifecycleBound = false;

function persistBeforePageExit() {
  activeRuntimes.forEach((runtime) => {
    if (!runtime?.finalized && runtime.lastPayload) persistSessionRuntime(runtime, runtime.lastPayload);
  });
}

function bindLifecycle() {
  if (lifecycleBound) return;
  lifecycleBound = true;
  window.addEventListener("pagehide", persistBeforePageExit);
  window.addEventListener("beforeunload", persistBeforePageExit);
}

export function buildSelectedSources(selectedSections = []) {
  const grouped = new Map();
  selectedSections.forEach(({ dictionaryId, sectionId }) => {
    const dictionary = String(dictionaryId || "").trim();
    if (!dictionary) return;
    if (!grouped.has(dictionary)) grouped.set(dictionary, new Set());
    grouped.get(dictionary).add(String(sectionId || ""));
  });
  return Array.from(grouped.entries()).map(([dictionary_id, sections]) => ({
    dictionary_id,
    section_ids: Array.from(sections),
  }));
}

export function createSessionRuntime(type, basePayload = {}) {
  const normalizedType = String(type || "").trim();
  if (!SESSION_QUEUE_TYPES[normalizedType]) throw new Error(`Unknown session type: ${normalizedType}`);
  const id = createSessionId();
  const clock = createActivityClock();
  const runtime = {
    id,
    type: normalizedType,
    scope: getStorageScope(),
    clock,
    basePayload: {
      id,
      translation_language_code: getTranslationLanguageCode(),
      ...basePayload,
    },
    lastPayload: null,
    finalized: false,
  };
  activeRuntimes.add(runtime);
  bindLifecycle();
  return runtime;
}

export function persistSessionRuntime(runtime, payload = {}) {
  if (!runtime || runtime.finalized) return false;
  runtime.lastPayload = { ...payload };
  return saveActiveSession(runtime.type, {
    ...runtime.basePayload,
    ...runtime.clock.snapshot(),
    ...runtime.lastPayload,
    status: "active",
    exit_reason: null,
  }, runtime.scope);
}

export function finalizeSessionRuntime(runtime, {
  status = "completed",
  exitReason = null,
  payload = {},
} = {}) {
  if (!runtime || runtime.finalized) return false;
  runtime.finalized = true;
  activeRuntimes.delete(runtime);
  const queueType = SESSION_QUEUE_TYPES[runtime.type];
  const finalPayload = {
    ...runtime.basePayload,
    ...runtime.clock.stop(),
    ...payload,
    status: status === "completed" ? "completed" : "interrupted",
    exit_reason: status === "completed" ? null : String(exitReason || "route_change"),
  };
  removeActiveSession(runtime.type, runtime.scope);
  enqueueProgress(queueType, finalPayload, {
    scope: runtime.scope,
    id: `${queueType}:${runtime.id}`,
    replace: false,
  });
  recordActivitySession(runtime.type, finalPayload);
  return finalPayload;
}

export function snapshotRecoveredSession(snapshot, exitReason = "close") {
  const startedAt = Date.parse(snapshot?.started_at || "") || Date.now();
  const endedAt = Date.now();
  return {
    ...snapshot,
    ended_at: new Date(endedAt).toISOString(),
    duration_sec: Math.max(Number(snapshot?.duration_sec || 0), Math.round((endedAt - startedAt) / 1000)),
    active_duration_sec: Math.max(0, Number(snapshot?.active_duration_sec || 0)),
    status: "interrupted",
    exit_reason: String(exitReason || "close"),
  };
}

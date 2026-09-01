import { getTranslationLanguageCode } from "../settings/user-settings-store.js?v=13.12";
import { createActivityClock } from "./activity-clock.js?v=13.9.0";
import { enqueueProgress } from "./progress-queue.js?v=13.9.0";
import { createSessionId, removeActiveSession, saveActiveSession } from "./session-store.js?v=13.9.0";
import { getStorageScope } from "./storage-scope.js?v=13.9.0";
import { recordActivitySession } from "./activity-history-store.js?v=13.9.0";
import {
  SESSION_QUEUE_TYPES,
  buildActiveSessionPayload,
  buildFinalSessionPayload,
  buildSelectedSources,
  normalizeSessionType,
  snapshotRecoveredSession,
} from "../../../packages/alantil-core/session.js";

export { buildSelectedSources, snapshotRecoveredSession };

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

export function createSessionRuntime(type, basePayload = {}) {
  const normalizedType = normalizeSessionType(type);
  if (!normalizedType) throw new Error(`Unknown session type: ${String(type || "").trim()}`);
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
  return saveActiveSession(runtime.type, buildActiveSessionPayload(runtime, runtime.clock.snapshot(), runtime.lastPayload), runtime.scope);
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
  const finalPayload = buildFinalSessionPayload(runtime, runtime.clock.stop(), { status, exitReason, payload });
  removeActiveSession(runtime.type, runtime.scope);
  enqueueProgress(queueType, finalPayload, {
    scope: runtime.scope,
    id: `${queueType}:${runtime.id}`,
    replace: false,
  });
  recordActivitySession(runtime.type, finalPayload);
  return finalPayload;
}

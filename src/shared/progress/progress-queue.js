import {
  getStorageScope,
  readScopedJson,
  writeScopedJson,
} from "./storage-scope.js?v=13.9.0";
import {
  enqueueProgressEntry,
  mergeProgressQueueEntries,
  normalizeProgressQueue,
  progressQueueEntryId,
  removeProgressQueueEntry,
  updateProgressQueueEntry,
} from "../../../packages/alantil-core/sync-policy.js";

export const PROGRESS_QUEUE_KEY = "alantil_progress_queue_v1";
const listeners = new Set();

function notify(scope = getStorageScope()) {
  const queue = readProgressQueue(scope);
  listeners.forEach((listener) => {
    try {
      listener(queue, scope);
    } catch (error) {
      console.error("Progress queue subscriber failed", error);
    }
  });
}

export function readProgressQueue(scope = getStorageScope()) {
  return normalizeProgressQueue(readScopedJson(PROGRESS_QUEUE_KEY, [], scope));
}

export function writeProgressQueue(queue, scope = getStorageScope()) {
  const saved = writeScopedJson(PROGRESS_QUEUE_KEY, normalizeProgressQueue(queue), scope);
  if (saved) notify(scope);
  return saved;
}

function generatedQueueId() {
  return String(globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
}

export function queueEntryId(type, payload = {}) {
  return progressQueueEntryId(type, payload, generatedQueueId());
}

export function enqueueProgress(type, payload, {
  scope = getStorageScope(),
  id = queueEntryId(type, payload),
  replace = true,
  claimId = "",
} = {}) {
  const result = enqueueProgressEntry(readProgressQueue(scope), type, payload, {
    id,
    replace,
    claimId,
    createdAt: new Date().toISOString(),
  });
  if (!result.entry) return null;
  writeProgressQueue(result.queue, scope);
  window.dispatchEvent(new CustomEvent("alantil:progress-queued", { detail: { scope, id } }));
  return result.entry;
}

export function removeProgressEntry(id, scope = getStorageScope()) {
  const result = removeProgressQueueEntry(readProgressQueue(scope), id);
  if (!result.changed) return false;
  return writeProgressQueue(result.queue, scope);
}

export function updateProgressEntry(id, updates, scope = getStorageScope()) {
  const result = updateProgressQueueEntry(readProgressQueue(scope), id, updates);
  if (!result.changed) return false;
  return writeProgressQueue(result.queue, scope);
}

export function mergeProgressQueues(sourceEntries, scope = getStorageScope(), { claimId = "" } = {}) {
  return writeProgressQueue(mergeProgressQueueEntries(readProgressQueue(scope), sourceEntries, { claimId }), scope);
}

export function subscribeProgressQueue(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

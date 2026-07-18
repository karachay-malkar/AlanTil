import {
  getStorageScope,
  readScopedJson,
  writeScopedJson,
} from "./storage-scope.js?v=13.9.0";

export const PROGRESS_QUEUE_KEY = "alantil_progress_queue_v1";
const listeners = new Set();

function normalizeQueue(value) {
  return Array.isArray(value) ? value.filter((entry) => entry && entry.id && entry.type) : [];
}

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
  return normalizeQueue(readScopedJson(PROGRESS_QUEUE_KEY, [], scope));
}

export function writeProgressQueue(queue, scope = getStorageScope()) {
  const saved = writeScopedJson(PROGRESS_QUEUE_KEY, normalizeQueue(queue), scope);
  if (saved) notify(scope);
  return saved;
}

export function queueEntryId(type, payload = {}) {
  const typeName = String(type || "").trim();
  const stableId = payload.id
    || payload.session_id
    || [payload.dictionary_id, payload.section_id, payload.set_id, payload.word_id, payload.song_id]
      .filter((value) => value !== undefined && value !== null && value !== "")
      .join(":");
  return `${typeName}:${String(stableId || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`)}`;
}

export function enqueueProgress(type, payload, {
  scope = getStorageScope(),
  id = queueEntryId(type, payload),
  replace = true,
  claimId = "",
} = {}) {
  if (!type || !payload) return null;
  const queue = readProgressQueue(scope);
  const entry = {
    id,
    type: String(type),
    payload,
    claim_id: String(claimId || ""),
    created_at: new Date().toISOString(),
    attempts: 0,
  };
  const index = queue.findIndex((item) => item.id === id);
  if (index >= 0 && replace) queue[index] = { ...queue[index], ...entry, created_at: queue[index].created_at || entry.created_at };
  else if (index < 0) queue.push(entry);
  writeProgressQueue(queue, scope);
  window.dispatchEvent(new CustomEvent("alantil:progress-queued", { detail: { scope, id } }));
  return entry;
}

export function removeProgressEntry(id, scope = getStorageScope()) {
  const queue = readProgressQueue(scope);
  const next = queue.filter((entry) => entry.id !== id);
  if (next.length === queue.length) return false;
  return writeProgressQueue(next, scope);
}

export function updateProgressEntry(id, updates, scope = getStorageScope()) {
  const queue = readProgressQueue(scope);
  const index = queue.findIndex((entry) => entry.id === id);
  if (index < 0) return false;
  queue[index] = { ...queue[index], ...updates };
  return writeProgressQueue(queue, scope);
}

export function mergeProgressQueues(sourceEntries, scope = getStorageScope(), { claimId = "" } = {}) {
  const queue = readProgressQueue(scope);
  const byId = new Map(queue.map((entry) => [entry.id, entry]));
  normalizeQueue(sourceEntries).forEach((entry) => {
    const current = byId.get(entry.id);
    if (entry.type === "user_settings") {
      // Guest setup may replace only the blank settings entry prepared for a
      // brand-new account. Existing cloud or pending account settings win.
      if (!current || current.payload?.learning_setup_completed_at) return;
      byId.set(entry.id, { ...entry, claim_id: claimId || entry.claim_id || "" });
      return;
    }
    if (current) return;
    byId.set(entry.id, { ...entry, claim_id: claimId || entry.claim_id || "" });
  });
  return writeProgressQueue(Array.from(byId.values()), scope);
}

export function subscribeProgressQueue(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

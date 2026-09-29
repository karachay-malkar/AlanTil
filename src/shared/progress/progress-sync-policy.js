import { progressQueueRevisionToken } from "../../../packages/alantil-core/sync-policy.js";

export function nextUnattemptedProgressEntry(queue = [], attemptedRevisions = new Set()) {
  return (Array.isArray(queue) ? queue : []).find((entry) => (
    entry?.id && !attemptedRevisions.has(progressQueueRevisionToken(entry))
  )) || null;
}

export function shouldDiscardProgressError(entry, error) {
  return entry?.type === "word_favorite" && error?.code === "23503";
}

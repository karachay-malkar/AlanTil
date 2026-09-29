import { progressQueueRevisionToken } from "../../../packages/alantil-core/sync-policy.js?v=16.8.0.9";

export function nextUnattemptedProgressEntry(queue = [], attemptedTokens = new Set()) {
  return (Array.isArray(queue) ? queue : []).find((entry) => (
    entry?.id && !attemptedTokens.has(progressQueueRevisionToken(entry))
  )) || null;
}

export function shouldDiscardProgressError(entry, error) {
  return entry?.type === "word_favorite" && error?.code === "23503";
}

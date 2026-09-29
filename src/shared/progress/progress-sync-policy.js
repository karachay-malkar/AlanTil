export function progressQueueAttemptKey(entry) {
  const id = String(entry?.id || "");
  const revision = Math.max(1, Math.floor(Number(entry?.revision || 1)) || 1);
  return id ? `${id}@${revision}` : "";
}

export function nextUnattemptedProgressEntry(queue = [], attemptedIds = new Set()) {
  return (Array.isArray(queue) ? queue : []).find((entry) => {
    if (!entry?.id) return false;
    return !attemptedIds.has(entry.id) && !attemptedIds.has(progressQueueAttemptKey(entry));
  }) || null;
}

export function shouldDiscardProgressError(entry, error) {
  return entry?.type === "word_favorite" && error?.code === "23503";
}

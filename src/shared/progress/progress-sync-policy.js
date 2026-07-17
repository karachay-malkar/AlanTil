export function nextUnattemptedProgressEntry(queue = [], attemptedIds = new Set()) {
  return (Array.isArray(queue) ? queue : []).find((entry) => entry?.id && !attemptedIds.has(entry.id)) || null;
}

export function shouldDiscardProgressError(entry, error) {
  return entry?.type === "word_favorite" && error?.code === "23503";
}

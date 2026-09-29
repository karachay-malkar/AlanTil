export function normalizeProgressQueue(value) {
  return Array.isArray(value) ? value.filter((entry) => entry && entry.id && entry.type) : [];
}

export function progressQueueEntryRevision(entry) {
  const value = Math.floor(Number(entry?.revision || 1));
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function progressQueueEntryId(type, payload = {}, generatedId = '') {
  const typeName = String(type || '').trim();
  const stableId = payload.id
    || payload.session_id
    || [payload.dictionary_id, payload.section_id, payload.set_id, payload.word_id, payload.song_id]
      .filter((value) => value !== undefined && value !== null && value !== '')
      .join(':');
  return `${typeName}:${String(stableId || generatedId)}`;
}

export function enqueueProgressEntry(queue, type, payload, {
  id,
  replace = true,
  claimId = '',
  createdAt = new Date().toISOString(),
} = {}) {
  if (!type || !payload || !id) return { queue: normalizeProgressQueue(queue), entry: null };
  const next = normalizeProgressQueue(queue).slice();
  const index = next.findIndex((item) => item.id === id);
  const current = index >= 0 ? next[index] : null;
  const entry = {
    id,
    type: String(type),
    payload,
    claim_id: String(claimId || ''),
    created_at: createdAt,
    attempts: 0,
    revision: current && replace ? progressQueueEntryRevision(current) + 1 : 1,
  };
  if (index >= 0 && replace) next[index] = { ...next[index], ...entry, created_at: next[index].created_at || entry.created_at };
  else if (index < 0) next.push(entry);
  return { queue: next, entry };
}

export function removeProgressQueueEntry(queue, id, { revision = null } = {}) {
  const current = normalizeProgressQueue(queue);
  const expectedRevision = revision === null || revision === undefined
    ? null
    : progressQueueEntryRevision({ revision });
  const next = current.filter((entry) => entry.id !== id
    || (expectedRevision !== null && progressQueueEntryRevision(entry) !== expectedRevision));
  return { queue: next, changed: next.length !== current.length };
}

export function updateProgressQueueEntry(queue, id, updates, { revision = null } = {}) {
  const next = normalizeProgressQueue(queue).slice();
  const expectedRevision = revision === null || revision === undefined
    ? null
    : progressQueueEntryRevision({ revision });
  const index = next.findIndex((entry) => entry.id === id
    && (expectedRevision === null || progressQueueEntryRevision(entry) === expectedRevision));
  if (index < 0) return { queue: next, changed: false };
  next[index] = { ...next[index], ...updates };
  return { queue: next, changed: true };
}

export function mergeProgressQueueEntries(targetEntries, sourceEntries, { claimId = '' } = {}) {
  const byId = new Map(normalizeProgressQueue(targetEntries).map((entry) => [entry.id, entry]));
  normalizeProgressQueue(sourceEntries).forEach((entry) => {
    const current = byId.get(entry.id);
    if (entry.type === 'user_settings') {
      if (!current || current.payload?.learning_setup_completed_at) return;
      byId.set(entry.id, {
        ...entry,
        claim_id: claimId || entry.claim_id || '',
        revision: progressQueueEntryRevision(current) + 1,
      });
      return;
    }
    if (current) return;
    byId.set(entry.id, {
      ...entry,
      claim_id: claimId || entry.claim_id || '',
      revision: progressQueueEntryRevision(entry),
    });
  });
  return Array.from(byId.values());
}

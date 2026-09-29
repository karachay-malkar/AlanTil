function normalizeRevision(value) {
  const revision = Number(value);
  return Number.isInteger(revision) && revision > 0 ? revision : 1;
}

export function normalizeProgressQueue(value) {
  return (Array.isArray(value) ? value : [])
    .filter((entry) => entry && entry.id && entry.type)
    .map((entry) => ({ ...entry, revision: normalizeRevision(entry.revision) }));
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

export function progressQueueRevisionToken(entry = {}) {
  return `${String(entry.id || '')}@${normalizeRevision(entry.revision)}`;
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
  const revision = current ? normalizeRevision(current.revision) + 1 : 1;
  const entry = {
    id,
    type: String(type),
    payload,
    claim_id: String(claimId || ''),
    created_at: current?.created_at || createdAt,
    attempts: 0,
    revision,
  };
  if (index >= 0 && replace) next[index] = entry;
  else if (index < 0) next.push(entry);
  return { queue: next, entry: index >= 0 && !replace ? current : entry };
}

export function removeProgressQueueEntry(queue, id, revision = null) {
  const current = normalizeProgressQueue(queue);
  const expectedRevision = revision === null || revision === undefined ? null : normalizeRevision(revision);
  const next = current.filter((entry) => (
    entry.id !== id
    || (expectedRevision !== null && normalizeRevision(entry.revision) !== expectedRevision)
  ));
  return { queue: next, changed: next.length !== current.length };
}

export function updateProgressQueueEntry(queue, id, updates, revision = null) {
  const next = normalizeProgressQueue(queue).slice();
  const expectedRevision = revision === null || revision === undefined ? null : normalizeRevision(revision);
  const index = next.findIndex((entry) => (
    entry.id === id
    && (expectedRevision === null || normalizeRevision(entry.revision) === expectedRevision)
  ));
  if (index < 0) return { queue: next, changed: false };
  next[index] = { ...next[index], ...updates, revision: normalizeRevision(next[index].revision) };
  return { queue: next, changed: true };
}

export function mergeProgressQueueEntries(targetEntries, sourceEntries, { claimId = '' } = {}) {
  const byId = new Map(normalizeProgressQueue(targetEntries).map((entry) => [entry.id, entry]));
  normalizeProgressQueue(sourceEntries).forEach((entry) => {
    const current = byId.get(entry.id);
    if (entry.type === 'user_settings') {
      if (current?.payload?.learning_setup_completed_at) return;
      byId.set(entry.id, {
        ...entry,
        claim_id: claimId || entry.claim_id || '',
        revision: current ? normalizeRevision(current.revision) + 1 : normalizeRevision(entry.revision),
        created_at: current?.created_at || entry.created_at,
      });
      return;
    }
    if (current) return;
    byId.set(entry.id, { ...entry, claim_id: claimId || entry.claim_id || '' });
  });
  return Array.from(byId.values());
}

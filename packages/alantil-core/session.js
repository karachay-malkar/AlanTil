export const SESSION_QUEUE_TYPES = Object.freeze({
  learn: 'learn_session',
  test: 'test_session',
  match: 'match_session',
});

export function buildSelectedSources(selectedSections = []) {
  const grouped = new Map();
  selectedSections.forEach(({ dictionaryId, sectionId }) => {
    const dictionary = String(dictionaryId || '').trim();
    const section = String(sectionId || '').trim();
    if (!dictionary || !section) return;
    if (!grouped.has(dictionary)) grouped.set(dictionary, new Set());
    grouped.get(dictionary).add(section);
  });
  return Array.from(grouped.entries()).map(([dictionary_id, sections]) => ({
    dictionary_id,
    section_ids: Array.from(sections),
  }));
}

export function normalizeSessionType(type) {
  const normalized = String(type || '').trim();
  return SESSION_QUEUE_TYPES[normalized] ? normalized : '';
}

export function buildActiveSessionPayload(runtime, clockSnapshot, payload = {}) {
  return {
    ...runtime.basePayload,
    ...clockSnapshot,
    ...payload,
    status: 'active',
    exit_reason: null,
  };
}

export function buildFinalSessionPayload(runtime, clockSnapshot, {
  status = 'completed',
  exitReason = null,
  payload = {},
} = {}) {
  return {
    ...runtime.basePayload,
    ...clockSnapshot,
    ...payload,
    status: status === 'completed' ? 'completed' : 'interrupted',
    exit_reason: status === 'completed' ? null : String(exitReason || 'route_change'),
  };
}

export function snapshotRecoveredSession(snapshot, exitReason = 'close', endedAt = Date.now()) {
  const startedAt = Date.parse(snapshot?.started_at || '') || endedAt;
  return {
    ...snapshot,
    ended_at: new Date(endedAt).toISOString(),
    duration_sec: Math.max(Number(snapshot?.duration_sec || 0), Math.round((endedAt - startedAt) / 1000)),
    active_duration_sec: Math.max(0, Number(snapshot?.active_duration_sec || 0)),
    status: 'interrupted',
    exit_reason: String(exitReason || 'close'),
  };
}

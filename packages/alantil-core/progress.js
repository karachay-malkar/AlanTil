import { CORE_PATH_CONFIG } from './path-config.js';
import { permanentSectionId, storyIdForDictionary } from './word-normalizer.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function stationProgressTime(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

export function effectiveStationStatus(row, now = Date.now()) {
  const status = String(row?.status || '');
  if (status === 'review_1_waiting' && stationProgressTime(row.review_1_due_at) <= now) return 'review_1_due';
  if (status === 'review_2_waiting' && stationProgressTime(row.review_2_due_at) <= now) return 'review_2_due';
  return status || 'available';
}

export function normalizeStationProgressRow(row = {}, fallback = {}, now = new Date().toISOString()) {
  const dictionaryId = String(row.dictionary_id || row.catalog_id || fallback.dictionaryId || CORE_PATH_CONFIG.dictionaryId).trim();
  const setId = String(row.set_id || fallback.setId || '').trim();
  const persistedSection = String(row.section_id || row.group_id || fallback.sectionId || fallback.groupId || '').trim();
  const sectionId = persistedSection && persistedSection !== dictionaryId
    ? persistedSection
    : permanentSectionId(dictionaryId, setId);
  const storyType = String(row.story_type || fallback.storyType || fallback.storyId || storyIdForDictionary(dictionaryId) || '').trim();
  const normalized = {
    dictionary_id: dictionaryId,
    catalog_id: dictionaryId,
    group_id: sectionId,
    set_id: setId,
    story_type: storyType,
    status: String(row.status || 'available'),
    current_phase: String(row.current_phase || 'study'),
    study_sessions_total: Math.max(0, Number(row.study_sessions_total || 0)),
    test_attempts_total: Math.max(0, Number(row.test_attempts_total || 0)),
    best_accuracy: Math.max(0, Math.min(100, Number(row.best_accuracy || 0))),
    first_test_completed_at: row.first_test_completed_at || null,
    review_1_due_at: row.review_1_due_at || null,
    review_1_completed_at: row.review_1_completed_at || null,
    review_2_due_at: row.review_2_due_at || null,
    review_2_completed_at: row.review_2_completed_at || null,
    mastered_at: row.mastered_at || null,
    updated_at: row.updated_at || now,
  };
  normalized.status = effectiveStationStatus(normalized);
  return normalized;
}

export function createStationProgressRow(station, updates = {}, now = new Date().toISOString()) {
  return normalizeStationProgressRow({
    dictionary_id: station?.dictionaryId ?? station?.dictionary_id,
    group_id: station?.sectionId ?? station?.section_id ?? station?.groupId ?? station?.group_id,
    set_id: station?.setId ?? station?.set_id,
    story_type: station?.storyType ?? station?.story_id ?? station?.storyId,
    ...updates,
  }, station || {}, now);
}

export function stationTestPhaseFromProgress(row) {
  const status = effectiveStationStatus(row || { status: 'test_ready' });
  if (status === 'review_1_due') return 'review_1';
  if (status === 'review_2_due') return 'review_2';
  if (status === 'mastered') return 'practice';
  return 'first_test';
}

export function transitionStationStarted(row, now = new Date().toISOString()) {
  const current = normalizeStationProgressRow(row, {}, now);
  if (['mastered', 'review_1_waiting', 'review_1_due', 'review_2_waiting', 'review_2_due', 'test_ready'].includes(current.status)) {
    return { row: current, changed: false };
  }
  return {
    changed: true,
    row: normalizeStationProgressRow({
      ...current,
      status: 'studying',
      current_phase: 'study',
      study_sessions_total: current.study_sessions_total + 1,
      updated_at: now,
    }, {}, now),
  };
}

export function markStationStartedProgress(row, now = new Date().toISOString()) {
  return transitionStationStarted(row, now).row;
}

export function transitionStationCardsCompleted(row, now = new Date().toISOString()) {
  const current = normalizeStationProgressRow(row, {}, now);
  if (current.status === 'mastered') return { row: current, changed: false };
  return {
    changed: true,
    row: normalizeStationProgressRow({
      ...current,
      status: 'test_ready',
      current_phase: 'first_test',
      updated_at: now,
    }, {}, now),
  };
}

export function markStationCardsCompletedProgress(row, now = new Date().toISOString()) {
  return transitionStationCardsCompleted(row, now).row;
}

export function recordStationTestProgress(row, {
  accuracy,
  passed,
  phase = stationTestPhaseFromProgress(row),
  completedAt = new Date().toISOString(),
} = {}) {
  const current = normalizeStationProgressRow(row, {}, completedAt);
  const next = {
    ...current,
    test_attempts_total: current.test_attempts_total + 1,
    best_accuracy: Math.max(current.best_accuracy, Number(accuracy || 0)),
    updated_at: completedAt,
  };

  if (!passed || phase === 'practice') return normalizeStationProgressRow(next, {}, completedAt);
  if (phase === 'first_test') {
    next.status = 'review_1_waiting';
    next.current_phase = 'review_1';
    next.first_test_completed_at = completedAt;
    next.review_1_due_at = new Date(Date.parse(completedAt) + CORE_PATH_CONFIG.review1DelayDays * DAY_MS).toISOString();
  } else if (phase === 'review_1') {
    next.status = 'review_2_waiting';
    next.current_phase = 'review_2';
    next.review_1_completed_at = completedAt;
    next.review_2_due_at = new Date(Date.parse(completedAt) + CORE_PATH_CONFIG.review2DelayDays * DAY_MS).toISOString();
  } else if (phase === 'review_2') {
    next.status = 'mastered';
    next.current_phase = 'mastered';
    next.review_2_completed_at = completedAt;
    next.mastered_at = completedAt;
  }
  return normalizeStationProgressRow(next, {}, completedAt);
}

export function stationProgressMapKey(row) {
  const normalized = normalizeStationProgressRow(row);
  return [normalized.story_type, normalized.dictionary_id, normalized.group_id, normalized.set_id].join('::');
}

export function mergeStationProgress(localRows = [], remoteRows = []) {
  const map = new Map();
  (Array.isArray(localRows) ? localRows : []).forEach((row) => {
    const normalized = normalizeStationProgressRow(row);
    if (!normalized.story_type || !normalized.dictionary_id || !normalized.group_id || !normalized.set_id) return;
    map.set(stationProgressMapKey(normalized), normalized);
  });
  (Array.isArray(remoteRows) ? remoteRows : []).forEach((row) => {
    const normalized = normalizeStationProgressRow(row);
    if (!normalized.story_type || !normalized.dictionary_id || !normalized.group_id || !normalized.set_id) return;
    const key = stationProgressMapKey(normalized);
    const existing = map.get(key);
    if (!existing || stationProgressTime(normalized.updated_at) >= stationProgressTime(existing.updated_at)) map.set(key, normalized);
  });
  return Array.from(map.values());
}

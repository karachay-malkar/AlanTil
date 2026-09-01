import { CORE_PATH_CONFIG } from './path-config.js';

export const CANONICAL_PROGRESS_STATUSES = Object.freeze([
  'not_started',
  'learning',
  'review',
  'mastered',
]);

const REVIEW_STATUSES = new Set([
  'review_1_waiting',
  'review_1_due',
  'review_2_waiting',
  'review_2_due',
]);

const LEARNING_STATUSES = new Set(['studying', 'test_ready']);
const DAY_MS = 24 * 60 * 60 * 1000;

export function progressTime(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

export function effectiveStationStatus(row, now = Date.now()) {
  const status = String(row?.status || '').trim();
  if (status === 'review_1_waiting' && progressTime(row?.review_1_due_at) <= now) return 'review_1_due';
  if (status === 'review_2_waiting' && progressTime(row?.review_2_due_at) <= now) return 'review_2_due';
  return status || 'available';
}

export function canonicalStationStatus(row, now = Date.now()) {
  const status = effectiveStationStatus(row, now);
  if (status === 'mastered') return 'mastered';
  if (REVIEW_STATUSES.has(status)) return 'review';
  if (LEARNING_STATUSES.has(status)) return 'learning';
  return 'not_started';
}

export function createStationProgressRow(station, now = new Date().toISOString()) {
  const storyType = String(station?.storyType ?? station?.storyId ?? '').trim();
  const dictionaryId = String(station?.dictionaryId ?? station?.dictionary_id ?? station?.catalogId ?? '').trim();
  const sectionId = String(station?.sectionId ?? station?.section_id ?? station?.groupId ?? station?.group_id ?? '').trim();
  const setId = String(station?.setId ?? station?.set_id ?? '').trim();
  return {
    dictionary_id: dictionaryId,
    catalog_id: dictionaryId,
    group_id: sectionId,
    set_id: setId,
    story_type: storyType,
    status: 'available',
    current_phase: 'study',
    study_sessions_total: 0,
    test_attempts_total: 0,
    best_accuracy: 0,
    first_test_completed_at: null,
    review_1_due_at: null,
    review_1_completed_at: null,
    review_2_due_at: null,
    review_2_completed_at: null,
    mastered_at: null,
    updated_at: now,
  };
}

export function normalizeStationLifecycle(row = {}, fallback = {}, now = Date.now()) {
  const base = createStationProgressRow(fallback, row?.updated_at || new Date(now).toISOString());
  const normalized = {
    ...base,
    ...row,
    dictionary_id: String(row?.dictionary_id || row?.catalog_id || base.dictionary_id).trim(),
    catalog_id: String(row?.dictionary_id || row?.catalog_id || base.dictionary_id).trim(),
    group_id: String(row?.group_id || row?.section_id || base.group_id).trim(),
    set_id: String(row?.set_id || base.set_id).trim(),
    story_type: String(row?.story_type || row?.story_id || base.story_type).trim(),
    status: String(row?.status || base.status),
    current_phase: String(row?.current_phase || base.current_phase),
    study_sessions_total: Math.max(0, Number(row?.study_sessions_total || 0)),
    test_attempts_total: Math.max(0, Number(row?.test_attempts_total || 0)),
    best_accuracy: Math.max(0, Math.min(100, Number(row?.best_accuracy || 0))),
    first_test_completed_at: row?.first_test_completed_at || null,
    review_1_due_at: row?.review_1_due_at || null,
    review_1_completed_at: row?.review_1_completed_at || null,
    review_2_due_at: row?.review_2_due_at || null,
    review_2_completed_at: row?.review_2_completed_at || null,
    mastered_at: row?.mastered_at || null,
    updated_at: row?.updated_at || base.updated_at,
  };
  normalized.status = effectiveStationStatus(normalized, now);
  return normalized;
}

export function markStationStartedProgress(current, updatedAt = new Date().toISOString()) {
  const row = normalizeStationLifecycle(current, {}, Date.parse(updatedAt) || Date.now());
  if (['mastered', 'review_1_waiting', 'review_1_due', 'review_2_waiting', 'review_2_due', 'test_ready'].includes(row.status)) return row;
  return {
    ...row,
    status: 'studying',
    current_phase: 'study',
    study_sessions_total: row.study_sessions_total + 1,
    updated_at: updatedAt,
  };
}

export function markStationCardsCompletedProgress(current, updatedAt = new Date().toISOString()) {
  const row = normalizeStationLifecycle(current, {}, Date.parse(updatedAt) || Date.now());
  if (row.status === 'mastered') return row;
  return {
    ...row,
    status: 'test_ready',
    current_phase: 'first_test',
    updated_at: updatedAt,
  };
}

export function stationTestPhaseFromProgress(current, now = Date.now()) {
  const status = effectiveStationStatus(current || { status: 'test_ready' }, now);
  if (status === 'review_1_due') return 'review_1';
  if (status === 'review_2_due') return 'review_2';
  if (status === 'mastered') return 'practice';
  return 'first_test';
}

export function recordStationTestProgress(current, {
  accuracy,
  passed,
  phase = stationTestPhaseFromProgress(current),
  completedAt = new Date().toISOString(),
  review1DelayDays = CORE_PATH_CONFIG.review1DelayDays,
  review2DelayDays = CORE_PATH_CONFIG.review2DelayDays,
} = {}) {
  const row = normalizeStationLifecycle(current, {}, Date.parse(completedAt) || Date.now());
  const next = {
    ...row,
    test_attempts_total: row.test_attempts_total + 1,
    best_accuracy: Math.max(row.best_accuracy, Math.max(0, Math.min(100, Number(accuracy || 0)))),
    updated_at: completedAt,
  };

  if (!passed || phase === 'practice') return next;
  const completedTime = progressTime(completedAt) || Date.now();
  if (phase === 'first_test') {
    next.status = 'review_1_waiting';
    next.current_phase = 'review_1';
    next.first_test_completed_at = completedAt;
    next.review_1_due_at = new Date(completedTime + Number(review1DelayDays || 0) * DAY_MS).toISOString();
  } else if (phase === 'review_1') {
    next.status = 'review_2_waiting';
    next.current_phase = 'review_2';
    next.review_1_completed_at = completedAt;
    next.review_2_due_at = new Date(completedTime + Number(review2DelayDays || 0) * DAY_MS).toISOString();
  } else if (phase === 'review_2') {
    next.status = 'mastered';
    next.current_phase = 'mastered';
    next.review_2_completed_at = completedAt;
    next.mastered_at = completedAt;
  }
  return next;
}

export function summarizeWordProgress(words = [], progressById) {
  const ids = (Array.isArray(words) ? words : [])
    .map((word) => String(word?.id ?? word?.word_id ?? word ?? '').trim())
    .filter(Boolean);
  let mastered = 0;
  let review = 0;
  ids.forEach((id) => {
    const row = typeof progressById?.get === 'function' ? progressById.get(id) : progressById?.[id];
    const status = String(row?.mastery_status || '');
    if (status === 'mastered' || status === 'review') mastered += 1;
    if (status === 'review') review += 1;
  });
  return {
    total: ids.length,
    mastered,
    review,
    percent: ids.length ? Math.round((mastered / ids.length) * 100) : 0,
  };
}

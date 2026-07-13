import { trackEvent } from "../../shared/analytics/analytics.js";
import { ACTIVITY_TYPES, CANCEL_REASONS, DIRECTIONS, EVENTS, WORD_RESULTS, WORD_SOURCES } from "../../shared/analytics/events.js";
import { createActivityTracker } from "../../shared/analytics/session-tracker.js";
import { buildWordsByPOSRounds } from "../../shared/domain/word-selection.js";
import { normalizeId } from "../../shared/domain/word-normalizer.js";
import { matchState } from "./state.js";

function wordById(id) {
  const normalized = normalizeId(id);
  return matchState.items.find((word) => normalizeId(word.id) === normalized) || null;
}

function trackWord(id, result) {
  const word = wordById(id);
  if (!word) return;
  trackEvent(EVENTS.WORD_RESULT, {
    word_id: word.id,
    source: WORD_SOURCES.MATCH,
    result,
    dictionary_id: word.dict,
    section_id: word.section,
    set_id: String(word.set),
    direction: DIRECTIONS.NONE,
  });
}

function abandonPreviousSession() {
  const tracker = matchState.session.tracker;
  if (tracker?.getStatus() !== "active") return;
  tracker.abandon(CANCEL_REASONS.NEW_SESSION, {
    items_total: matchState.total,
    items_completed: matchState.solvedCount,
    pairs_total: matchState.total,
    pairs_completed: matchState.solvedCount,
    progress_percent: Math.round((matchState.solvedCount / Math.max(1, matchState.total)) * 100),
    errors_count: matchState.errorsCount,
  });
}

export function startMatch(pool, limit, metadata = {}) {
  abandonPreviousSession();
  matchState.limit = [20, 40, 80].includes(Number(limit)) ? Number(limit) : 40;
  matchState.items = pool.slice();
  matchState.rounds = buildWordsByPOSRounds(pool, matchState.limit).rounds.filter((round) => round.length);
  matchState.roundIndex = 0;
  matchState.solvedCount = 0;
  matchState.total = matchState.rounds.reduce((sum, round) => sum + round.length, 0);
  matchState.errorsCount = 0;
  matchState.failMap = {};
  matchState.solved = new Set();
  matchState.locked = false;
  matchState.selected = null;
  matchState.session.inProgress = true;
  matchState.session.completed = false;
  matchState.session.wordsPool = pool.slice();
  matchState.session.progressData = { solved: 0, total: matchState.total, errors: 0 };
  matchState.session.metadata = { ...metadata };
  matchState.session.tracker = matchState.total ? createActivityTracker(ACTIVITY_TYPES.MATCH) : null;
  matchState.session.tracker?.start({
    direction: DIRECTIONS.NONE,
    limit: matchState.limit,
    items_total: matchState.total,
    items_completed: 0,
    pairs_total: matchState.total,
    dictionary_count: metadata.dictionaryCount || 0,
    section_count: metadata.sectionCount || 0,
  });
}

export function nextRound() {
  let round = [];
  while (matchState.roundIndex < matchState.rounds.length && round.length === 0) {
    round = matchState.rounds[matchState.roundIndex] || [];
    matchState.roundIndex += 1;
  }
  return round;
}

export function markSolved(id) {
  const normalized = normalizeId(id);
  if (!normalized || matchState.solved.has(normalized)) return;
  matchState.solved.add(normalized);
  matchState.solvedCount += 1;
  matchState.session.progressData.solved = matchState.solvedCount;
  trackWord(normalized, WORD_RESULTS.CORRECT);
}

function bumpFailure(id) {
  const normalized = normalizeId(id);
  if (!normalized || matchState.solved.has(normalized)) return;
  matchState.failMap[normalized] = (matchState.failMap[normalized] || 0) + 1;
}

export function recordMismatch(firstId, secondId) {
  matchState.errorsCount += 1;
  matchState.session.progressData.errors = matchState.errorsCount;
  bumpFailure(firstId);
  bumpFailure(secondId);
  trackWord(firstId, WORD_RESULTS.WRONG);
  trackWord(secondId, WORD_RESULTS.WRONG);
}

export function completeMatch() {
  if (!matchState.session.inProgress || matchState.session.completed) return false;
  matchState.session.inProgress = false;
  matchState.session.completed = true;
  return matchState.session.tracker?.complete({
    items_total: matchState.total,
    items_completed: matchState.total,
    pairs_total: matchState.total,
    pairs_completed: matchState.total,
    errors_count: matchState.errorsCount,
    rounds_count: matchState.rounds.length,
    dictionary_count: matchState.session.metadata.dictionaryCount || 0,
    section_count: matchState.session.metadata.sectionCount || 0,
  }) || false;
}

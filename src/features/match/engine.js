import { trackEvent } from "../../shared/analytics/analytics.js?v=13.8.1";
import { ACTIVITY_TYPES, CANCEL_REASONS, DIRECTIONS, EVENTS, WORD_RESULTS, WORD_SOURCES } from "../../shared/analytics/events.js?v=13.8.1";
import { createActivityTracker } from "../../shared/analytics/session-tracker.js?v=13.8.1";
import { buildWordsByPOSRounds } from "../../shared/domain/word-selection.js?v=13.8.1";
import { normalizeId } from "../../shared/domain/word-normalizer.js?v=13.8.1";
import {
  createSessionRuntime,
  finalizeSessionRuntime,
  persistSessionRuntime,
} from "../../shared/progress/session-builders.js?v=13.8.1";
import { recordMatchWordResults } from "../../shared/progress/word-progress-store.js?v=13.8.1";
import { matchState } from "./state.js?v=13.8.1";

function wordById(id) {
  const normalized = normalizeId(id);
  return matchState.items.find((word) => normalizeId(word.id) === normalized) || null;
}

function sessionItemIds() {
  return Array.from(matchState.shown || []).map(normalizeId).filter(Boolean);
}

function matchSessionWords() {
  return sessionItemIds().map((wordId) => ({
    word_id: wordId,
    matched: matchState.solved.has(wordId),
    error_count: Math.max(0, Number(matchState.failMap[wordId]) || 0),
  }));
}

function matchSessionErrors() {
  return Object.values(matchState.errorPairs || {})
    .filter((entry) => entry?.word_id_a && entry?.word_id_b && entry.error_count > 0)
    .map((entry) => ({
      word_id_a: entry.word_id_a,
      word_id_b: entry.word_id_b,
      error_count: Math.max(1, Number(entry.error_count) || 1),
    }));
}

function matchSessionPayload() {
  return {
    pairs_planned: matchState.total,
    pairs_completed: matchState.solvedCount,
    errors_total: matchState.errorsCount,
    rounds_total: matchState.roundIndex,
    words: matchSessionWords(),
    errors: matchSessionErrors(),
  };
}

function persistMatchSession() {
  persistSessionRuntime(matchState.session.runtime, matchSessionPayload());
}

export function finalizeMatchSession(status = "interrupted", exitReason = "route_change") {
  const session = matchState.session;
  if (!session.runtime || session.runtime.finalized) return false;
  const payload = matchSessionPayload();
  const result = finalizeSessionRuntime(session.runtime, {
    status,
    exitReason,
    payload,
  });
  if (result?.id && payload.words.length) {
    recordMatchWordResults(result.id, payload.words, result.ended_at || new Date().toISOString());
  }
  session.inProgress = false;
  session.completed = status === "completed";
  return result;
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
  if (matchState.session.runtime && !matchState.session.runtime.finalized) {
    finalizeMatchSession("interrupted", CANCEL_REASONS.NEW_SESSION);
  }
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
  matchState.errorPairs = {};
  matchState.solved = new Set();
  matchState.shown = new Set();
  matchState.locked = false;
  matchState.selected = null;
  matchState.session.inProgress = true;
  matchState.session.completed = false;
  matchState.session.wordsPool = pool.slice();
  matchState.session.progressData = { solved: 0, total: matchState.total, errors: 0 };
  matchState.session.metadata = { ...metadata };
  matchState.session.runtime = matchState.total ? createSessionRuntime("match", {
    selected_sources: Array.isArray(metadata.selectedSources) ? metadata.selectedSources : [],
  }) : null;
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
  persistMatchSession();
}

export function nextRound() {
  let round = [];
  while (matchState.roundIndex < matchState.rounds.length && round.length === 0) {
    round = matchState.rounds[matchState.roundIndex] || [];
    matchState.roundIndex += 1;
  }
  round.forEach((word) => {
    const wordId = normalizeId(word?.id);
    if (wordId) matchState.shown.add(wordId);
  });
  if (round.length) persistMatchSession();
  return round;
}

export function markSolved(id) {
  const normalized = normalizeId(id);
  if (!normalized || matchState.solved.has(normalized)) return;
  matchState.solved.add(normalized);
  matchState.solvedCount += 1;
  matchState.session.progressData.solved = matchState.solvedCount;
  trackWord(normalized, WORD_RESULTS.CORRECT);
  persistMatchSession();
}

function bumpFailure(id) {
  const normalized = normalizeId(id);
  if (!normalized || matchState.solved.has(normalized)) return;
  matchState.failMap[normalized] = (matchState.failMap[normalized] || 0) + 1;
}

function bumpErrorPair(firstId, secondId) {
  const pair = [normalizeId(firstId), normalizeId(secondId)].filter(Boolean).sort();
  if (pair.length !== 2 || pair[0] === pair[1]) return;
  const key = `${pair[0]}||${pair[1]}`;
  if (!matchState.errorPairs[key]) {
    matchState.errorPairs[key] = { word_id_a: pair[0], word_id_b: pair[1], error_count: 0 };
  }
  matchState.errorPairs[key].error_count += 1;
}

export function recordMismatch(firstId, secondId) {
  matchState.errorsCount += 1;
  matchState.session.progressData.errors = matchState.errorsCount;
  bumpFailure(firstId);
  bumpFailure(secondId);
  bumpErrorPair(firstId, secondId);
  trackWord(firstId, WORD_RESULTS.WRONG);
  trackWord(secondId, WORD_RESULTS.WRONG);
  persistMatchSession();
}

export function completeMatch() {
  if (!matchState.session.inProgress || matchState.session.completed) return false;
  finalizeMatchSession("completed", null);
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

import { trackEvent } from "../../shared/analytics/analytics.js?v=13.9.0";
import { ACTIVITY_TYPES, CANCEL_REASONS, DIRECTIONS, EVENTS, WORD_RESULTS, WORD_SOURCES } from "../../shared/analytics/events.js?v=13.9.0";
import { createActivityTracker } from "../../shared/analytics/session-tracker.js?v=13.9.0";
import {
  applyMatchPair,
  createMatchSessionState,
  matchSessionPayload,
  matchSessionSummary,
} from "../../shared/domain/practice-session.js?v=15.0.2";
import { normalizeId } from "../../shared/domain/word-normalizer.js?v=13.13";
import {
  createSessionRuntime,
  finalizeSessionRuntime,
  persistSessionRuntime,
} from "../../shared/progress/session-builders.js?v=13.13";
import { recordMatchWordResults } from "../../shared/progress/word-progress-store.js?v=13.9.0";
import { matchState } from "./state.js?v=13.9.0";

function wordById(id) {
  const normalized = normalizeId(id);
  return matchState.items.find((word) => normalizeId(word.id) === normalized) || null;
}

function domainState() {
  return {
    limit: matchState.limit,
    items: matchState.items,
    rounds: matchState.rounds,
    roundIndex: Math.max(0, matchState.roundIndex - 1),
    solved: matchState.solved,
    shown: matchState.shown,
    failMap: matchState.failMap,
    errorPairs: matchState.errorPairs,
    errorsCount: matchState.errorsCount,
    selectedSources: Array.isArray(matchState.session.metadata?.selectedSources) ? matchState.session.metadata.selectedSources : [],
  };
}

function payload() {
  return matchSessionPayload(domainState(), { includeSnapshot: false });
}

function persistMatchSession() {
  persistSessionRuntime(matchState.session.runtime, payload());
}

export function finalizeMatchSession(status = "interrupted", exitReason = "route_change") {
  const session = matchState.session;
  if (!session.runtime || session.runtime.finalized) return false;
  const sessionPayload = payload();
  const result = finalizeSessionRuntime(session.runtime, {
    status,
    exitReason,
    payload: sessionPayload,
  });
  if (result?.id && sessionPayload.words.length) {
    recordMatchWordResults(result.id, sessionPayload.words, result.ended_at || new Date().toISOString());
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
    dictionary_id: word.dictionary_id,
    section_id: word.section_id,
    set_id: String(word.set_id),
    direction: DIRECTIONS.NONE,
  });
}

function abandonPreviousSession() {
  if (matchState.session.runtime && !matchState.session.runtime.finalized) {
    finalizeMatchSession("interrupted", CANCEL_REASONS.NEW_SESSION);
  }
  const tracker = matchState.session.tracker;
  if (tracker?.getStatus() !== "active") return;
  const summary = matchSessionSummary(domainState());
  tracker.abandon(CANCEL_REASONS.NEW_SESSION, {
    items_total: summary.total,
    items_completed: summary.solved,
    pairs_total: summary.total,
    pairs_completed: summary.solved,
    progress_percent: Math.round((summary.solved / Math.max(1, summary.total)) * 100),
    errors_count: summary.errors,
  });
}

export function startMatch(pool, limit, metadata = {}) {
  abandonPreviousSession();
  const core = createMatchSessionState({
    pool,
    limit,
    selectedSources: Array.isArray(metadata.selectedSources) ? metadata.selectedSources : [],
  });
  matchState.limit = core.limit;
  matchState.items = core.items;
  matchState.rounds = core.rounds;
  matchState.roundIndex = 0;
  matchState.solvedCount = 0;
  matchState.total = core.rounds.reduce((sum, round) => sum + round.length, 0);
  matchState.errorsCount = core.errorsCount;
  matchState.failMap = core.failMap;
  matchState.errorPairs = core.errorPairs;
  matchState.solved = core.solved;
  matchState.shown = new Set();
  matchState.locked = false;
  matchState.selected = null;
  matchState.session.inProgress = true;
  matchState.session.completed = false;
  matchState.session.wordsPool = pool.slice();
  matchState.session.progressData = { solved: 0, total: matchState.total, errors: 0 };
  matchState.session.metadata = { ...metadata };
  matchState.session.runtime = matchState.total ? createSessionRuntime("match", {
    selected_sources: core.selectedSources,
  }) : null;
  matchState.session.tracker = matchState.total ? createActivityTracker(ACTIVITY_TYPES.MATCH) : null;
  matchState.session.tracker?.start({
    direction: DIRECTIONS.NONE,
    limit: core.limit,
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
  const transition = applyMatchPair(domainState(), normalized, normalized);
  if (!transition) return;
  matchState.solved = transition.state.solved;
  matchState.solvedCount = matchState.solved.size;
  matchState.session.progressData.solved = matchState.solvedCount;
  trackWord(normalized, WORD_RESULTS.CORRECT);
  persistMatchSession();
}

export function recordMismatch(firstId, secondId) {
  const transition = applyMatchPair(domainState(), firstId, secondId);
  if (!transition || transition.correct) return;
  matchState.errorsCount = transition.state.errorsCount;
  matchState.failMap = transition.state.failMap;
  matchState.errorPairs = transition.state.errorPairs;
  matchState.session.progressData.errors = matchState.errorsCount;
  trackWord(firstId, WORD_RESULTS.WRONG);
  trackWord(secondId, WORD_RESULTS.WRONG);
  persistMatchSession();
}

export function completeMatch() {
  if (!matchState.session.inProgress || matchState.session.completed) return false;
  finalizeMatchSession("completed", null);
  const summary = matchSessionSummary(domainState());
  return matchState.session.tracker?.complete({
    items_total: summary.total,
    items_completed: summary.total,
    pairs_total: summary.total,
    pairs_completed: summary.total,
    errors_count: summary.errors,
    rounds_count: matchState.rounds.length,
    dictionary_count: matchState.session.metadata.dictionaryCount || 0,
    section_count: matchState.session.metadata.sectionCount || 0,
  }) || false;
}
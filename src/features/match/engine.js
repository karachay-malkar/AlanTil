import { trackEvent } from "../../shared/analytics/analytics.js?v=13.9.0";
import { ACTIVITY_TYPES, CANCEL_REASONS, DIRECTIONS, EVENTS, WORD_RESULTS, WORD_SOURCES } from "../../shared/analytics/events.js?v=13.9.0";
import { createActivityTracker } from "../../shared/analytics/session-tracker.js?v=13.9.0";
import {
  createSessionRuntime,
  finalizeSessionRuntime,
  persistSessionRuntime,
} from "../../shared/progress/session-builders.js?v=13.13";
import { recordMatchWordResults } from "../../shared/progress/word-progress-store.js?v=13.9.0";
import { matchState } from "./state.js?v=13.9.0";
import {
  initializeMatchState,
  markMatchSolved,
  matchAbandonSummary,
  matchCompletionSummary,
  matchSessionPayload,
  matchWordById,
  recordMatchMismatch,
  takeNextMatchRound,
} from "../../../packages/alantil-core/match.js";

function persistMatchSession() {
  persistSessionRuntime(matchState.session.runtime, matchSessionPayload(matchState));
}

export function finalizeMatchSession(status = "interrupted", exitReason = "route_change") {
  const session = matchState.session;
  if (!session.runtime || session.runtime.finalized) return false;
  const payload = matchSessionPayload(matchState);
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
  const word = matchWordById(matchState, id);
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
  tracker.abandon(CANCEL_REASONS.NEW_SESSION, matchAbandonSummary(matchState));
}

export function startMatch(pool, limit, metadata = {}) {
  abandonPreviousSession();
  initializeMatchState(matchState, pool, limit, metadata);
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
  const round = takeNextMatchRound(matchState);
  if (round.length) persistMatchSession();
  return round;
}

export function markSolved(id) {
  const normalized = markMatchSolved(matchState, id);
  if (!normalized) return;
  trackWord(normalized, WORD_RESULTS.CORRECT);
  persistMatchSession();
}

export function recordMismatch(firstId, secondId) {
  const ids = recordMatchMismatch(matchState, firstId, secondId);
  ids.forEach((id) => trackWord(id, WORD_RESULTS.WRONG));
  persistMatchSession();
}

export function completeMatch() {
  if (!matchState.session.inProgress || matchState.session.completed) return false;
  finalizeMatchSession("completed", null);
  return matchState.session.tracker?.complete(matchCompletionSummary(matchState)) || false;
}

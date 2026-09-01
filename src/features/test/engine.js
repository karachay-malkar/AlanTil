import { trackEvent } from "../../shared/analytics/analytics.js?v=13.9.0";
import { ACTIVITY_TYPES, CANCEL_REASONS, EVENTS, WORD_RESULTS, WORD_SOURCES, directionFromMode } from "../../shared/analytics/events.js?v=13.9.0";
import { createActivityTracker } from "../../shared/analytics/session-tracker.js?v=13.9.0";
import {
  createSessionRuntime,
  finalizeSessionRuntime,
  persistSessionRuntime,
} from "../../shared/progress/session-builders.js?v=13.13";
import { testState } from "./state.js?v=13.9.0";
import { recordTestWordResults } from "../../shared/progress/word-progress-store.js?v=13.9.0";
import {
  applyTestAnswer,
  buildTestOptions,
  initializeTestState,
  testAbandonSummary,
  testCompletionSummary,
  testSessionPayload,
} from "../../../packages/alantil-core/test.js";

function persistTestSession() {
  persistSessionRuntime(testState.session.runtime, testSessionPayload(testState));
}

export function finalizeTestSession(status = "interrupted", exitReason = "route_change") {
  const session = testState.session;
  if (!session.runtime || session.runtime.finalized) return false;
  const payload = testSessionPayload(testState);
  const result = finalizeSessionRuntime(session.runtime, {
    status,
    exitReason,
    payload,
  });
  if (result?.id && payload.words.length) {
    const accuracy = payload.questions_answered
      ? Math.round((payload.correct_total / payload.questions_answered) * 100)
      : 0;
    recordTestWordResults({
      sessionId: result.id,
      answers: payload.words,
      accuracy,
      requiredAccuracy: 80,
      updateMastery: false,
      completedAt: result.ended_at || new Date().toISOString(),
    });
  }
  session.inProgress = false;
  session.completed = status === "completed";
  return result;
}

function abandonPreviousSession() {
  if (testState.session.runtime && !testState.session.runtime.finalized) {
    finalizeTestSession("interrupted", CANCEL_REASONS.NEW_SESSION);
  }
  const tracker = testState.session.tracker;
  if (tracker?.getStatus() !== "active") return;
  tracker.abandon(CANCEL_REASONS.NEW_SESSION, testAbandonSummary(testState));
}

export function startTest(pool, mode, limit, metadata = {}, optionPool = pool) {
  abandonPreviousSession();
  initializeTestState(testState, pool, mode, limit, metadata, optionPool);
  testState.session.runtime = testState.items.length ? createSessionRuntime("test", {
    selected_sources: Array.isArray(metadata.selectedSources) ? metadata.selectedSources : [],
    direction: directionFromMode(testState.mode),
  }) : null;
  testState.session.tracker = testState.items.length ? createActivityTracker(ACTIVITY_TYPES.TEST) : null;
  testState.session.tracker?.start({
    direction: directionFromMode(testState.mode),
    limit: testState.limit,
    items_total: testState.items.length,
    items_completed: 0,
    questions_total: testState.items.length,
    dictionary_count: metadata.dictionaryCount || 0,
    section_count: metadata.sectionCount || 0,
  });
  persistTestSession();
}

export function pickOptions(item) {
  return buildTestOptions(testState, item);
}

export function submitAnswer(answer) {
  const transition = applyTestAnswer(testState, answer);
  if (!transition) return false;
  const { item, isCorrect } = transition;
  trackEvent(EVENTS.WORD_RESULT, {
    word_id: item.id,
    source: WORD_SOURCES.TEST,
    result: isCorrect ? WORD_RESULTS.CORRECT : WORD_RESULTS.WRONG,
    dictionary_id: item.dictionary_id,
    section_id: item.section_id,
    set_id: String(item.set_id),
    direction: directionFromMode(testState.mode),
  });
  persistTestSession();
  return true;
}

export function completeTest() {
  if (!testState.session.inProgress || testState.session.completed) return false;
  finalizeTestSession("completed", null);
  return testState.session.tracker?.complete(testCompletionSummary(testState)) || false;
}

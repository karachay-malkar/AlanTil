import { trackEvent } from "../../shared/analytics/analytics.js?v=13.9.0";
import { ACTIVITY_TYPES, CANCEL_REASONS, EVENTS, WORD_RESULTS, WORD_SOURCES, directionFromMode } from "../../shared/analytics/events.js?v=13.9.0";
import { createActivityTracker } from "../../shared/analytics/session-tracker.js?v=13.9.0";
import {
  buildTestSessionOptions,
  createTestSessionState,
  submitTestAnswer,
  testSessionPayload,
  testSessionSummary,
} from "../../shared/domain/practice-session.js?v=15.0.2";
import {
  createSessionRuntime,
  finalizeSessionRuntime,
  persistSessionRuntime,
} from "../../shared/progress/session-builders.js?v=13.13";
import { testState } from "./state.js?v=13.9.0";
import { recordTestWordResults } from "../../shared/progress/word-progress-store.js?v=13.9.0";

function domainState() {
  return {
    mode: testState.mode,
    limit: testState.limit,
    items: testState.items,
    optionPool: testState.optionPool,
    index: testState.index,
    correct: testState.correct,
    results: testState.results,
    selectedSources: Array.isArray(testState.session.metadata?.selectedSources) ? testState.session.metadata.selectedSources : [],
  };
}

function payload() {
  return testSessionPayload(domainState(), { includeSnapshot: false });
}

function persistTestSession() {
  persistSessionRuntime(testState.session.runtime, payload());
}

export function finalizeTestSession(status = "interrupted", exitReason = "route_change") {
  const session = testState.session;
  if (!session.runtime || session.runtime.finalized) return false;
  const sessionPayload = payload();
  const result = finalizeSessionRuntime(session.runtime, {
    status,
    exitReason,
    payload: sessionPayload,
  });
  if (result?.id && sessionPayload.words.length) {
    const accuracy = sessionPayload.questions_answered
      ? Math.round((sessionPayload.correct_total / sessionPayload.questions_answered) * 100)
      : 0;
    recordTestWordResults({
      sessionId: result.id,
      answers: sessionPayload.words,
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
  const summary = testSessionSummary(domainState());
  tracker.abandon(CANCEL_REASONS.NEW_SESSION, {
    questions_total: summary.total,
    questions_answered: testState.index,
    items_total: summary.total,
    items_completed: testState.index,
    progress_percent: Math.round((testState.index / Math.max(1, summary.total)) * 100),
    correct_count: testState.correct,
    wrong_count: Math.max(0, testState.index - testState.correct),
  });
}

export function startTest(pool, mode, limit, metadata = {}, optionPool = pool) {
  abandonPreviousSession();
  const core = createTestSessionState({
    pool,
    optionPool,
    mode,
    limit,
    selectedSources: Array.isArray(metadata.selectedSources) ? metadata.selectedSources : [],
  });
  testState.mode = core.mode;
  testState.limit = core.limit;
  testState.optionPool = core.optionPool;
  testState.items = core.items;
  testState.index = core.index;
  testState.correct = core.correct;
  testState.selectedAnswer = null;
  testState.results = core.results;
  testState.session.inProgress = true;
  testState.session.completed = false;
  testState.session.wordsPool = pool.slice();
  testState.session.progressData = { index: 0, total: core.items.length, correct: 0 };
  testState.session.metadata = { ...metadata };
  testState.session.runtime = core.items.length ? createSessionRuntime("test", {
    selected_sources: core.selectedSources,
    direction: directionFromMode(core.mode),
  }) : null;
  testState.session.tracker = core.items.length ? createActivityTracker(ACTIVITY_TYPES.TEST) : null;
  testState.session.tracker?.start({
    direction: directionFromMode(core.mode),
    limit: core.limit,
    items_total: core.items.length,
    items_completed: 0,
    questions_total: core.items.length,
    dictionary_count: metadata.dictionaryCount || 0,
    section_count: metadata.sectionCount || 0,
  });
  persistTestSession();
}

export function pickOptions(item) {
  return buildTestSessionOptions(domainState(), item, 4);
}

export function submitAnswer(answer) {
  const current = domainState();
  const item = current.items[current.index];
  const transition = submitTestAnswer(current, answer);
  if (!item || !transition) return false;
  testState.index = transition.state.index;
  testState.correct = transition.state.correct;
  testState.results = transition.state.results;
  testState.selectedAnswer = null;
  testState.session.progressData.index = testState.index;
  testState.session.progressData.correct = testState.correct;
  trackEvent(EVENTS.WORD_RESULT, {
    word_id: item.id,
    source: WORD_SOURCES.TEST,
    result: transition.result.isCorrect ? WORD_RESULTS.CORRECT : WORD_RESULTS.WRONG,
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
  const summary = testSessionSummary(domainState());
  return testState.session.tracker?.complete({
    items_total: summary.total,
    items_completed: summary.total,
    questions_total: summary.total,
    questions_answered: summary.total,
    correct_count: summary.correct,
    wrong_count: summary.wrong,
    accuracy_percent: summary.percentage,
    dictionary_count: testState.session.metadata.dictionaryCount || 0,
    section_count: testState.session.metadata.sectionCount || 0,
  }) || false;
}